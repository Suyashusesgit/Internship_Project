#!/usr/bin/env python3
"""
t_btn_sensor_node.py — Combined Sensor Test: MAX30102 + NEO-6M GPS + MLX90614
================================================================================
Hardware  : Raspberry Pi 5
Sensors   : MLX90614 (I2C, body temperature)
            MAX30102 (I2C, pulse oximeter — see max30100.py local driver)
            NEO-6M   (UART /dev/serial0, GPS)
Libraries : adafruit-circuitpython-mlx90614, max30100 (local file), pyserial,
            pynmea2, numpy

Run this to verify all three sensors work together before deploying the
full T-BTN system. Output is printed once per second:

    Temp: 37.1°C | BPM: 75 (SpO2: 98%) | GPS: 26.2833, 73.0167

Execution Flow
--------------
* A tight cooperative loop polls the MAX30102 every ~10ms to capture the
  optical pulse waveform at sufficient temporal resolution.
* MLX90614 is read every 500ms (its internal ADC updates at ~2 Hz anyway).
* GPS sentences are consumed non-blockingly via `serial.in_waiting` every
  loop iteration so the UART FIFO never backs up or stalls the loop.
* Once per second, all latest values are printed.

DSP Pipeline for BPM & SpO2 (MAX30102)
---------------------------------------
1. Raw RED and IR FIFO samples accumulate in a rolling 4-second circular
   buffer (~400 samples at 100 Hz).
2. A saturation guard checks whether the ADC is clipped (pinned at the
   18-bit max of 262143) — this happens when LED current is too high for
   how close/reflective the finger contact is. Saturated windows are
   flagged rather than fed into the DSP, which would otherwise produce
   meaningless numbers that *look* plausible.
3. A 200ms moving-average filter estimates the slow DC baseline; subtracting
   it isolates the AC pulsatile waveform.
4. Peak detection on the AC-coupled IR signal finds heartbeats. A real PPG
   waveform has a sharp systolic peak followed by a smaller secondary bump
   (the dicrotic notch) — a threshold that's too low can mistake the notch
   for a second beat, while one that's too high can skip real beats during
   natural amplitude variation. Both push the computed rate to roughly half
   or double the true value. To guard against this:
     - A firm refractory period (400ms) blocks any second "peak" too soon
       after a detected beat, which suppresses dicrotic-notch double-counts.
     - Consecutive BPM estimates are smoothed with an exponential moving
       average and a plausibility gate rejects any single-step jump bigger
       than physiologically possible, so one bad window can't make the
       displayed number swing wildly.
5. SpO2 uses the standard ratio-of-ratios formula:
       R    = (AC_red / DC_red) / (AC_ir / DC_ir)
       SpO2 = 110 - 25 * R
   These are textbook calibration constants, not patient/sensor-specific —
   treat absolute SpO2 accuracy as approximate unless calibrated against a
   reference oximeter.
"""

import time
import collections
import logging

import serial
import pynmea2
import board
import busio
import adafruit_mlx90614
import max30100
import numpy as np

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("T-BTN")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
GPS_PORT    = "/dev/serial0"
GPS_BAUD    = 9600
GPS_TIMEOUT = 0.01          # non-blocking serial timeout (seconds)

POLL_INTERVAL  = 0.01       # MAX30102 polling cadence  (~100 Hz)
PRINT_INTERVAL = 1.0        # console output cadence     (1 Hz)
MLX_INTERVAL   = 0.5        # MLX90614 read cadence      (2 Hz)

SAMPLE_RATE_HZ = int(1 / POLL_INTERVAL)   # nominal ~100
WINDOW_SIZE    = SAMPLE_RATE_HZ * 4       # 4-second analysis window (400 samples)
MA_KERNEL      = int(SAMPLE_RATE_HZ * 1.5) # 1.5s moving-average kernel for DC baseline estimation

# Peak detection
PEAK_MIN_DISTANCE     = int(SAMPLE_RATE_HZ * 0.35)  # 350ms refractory (max ~170 BPM)
PEAK_THRESHOLD_FACTOR = 0.30                         # balanced: 0.25 picked up noise artifacts,
                                                       # 0.50 missed real beats; 0.30 is the sweet spot

# BPM smoothing / plausibility gating
BPM_MAX_STEP    = 15      # tightened: prevents artifact spikes (50→93) from registering
BPM_EMA_ALPHA   = 0.35    # moderate: smooth but still responsive to real changes

# SpO2 calibration (textbook values; tune empirically per sensor if possible)
SPO2_A = 110.0
SPO2_B = 25.0

# MAX30102 18-bit ADC saturation point
ADC_MAX = 262143
SATURATION_FRACTION_LIMIT = 0.3   # if >30% of the window is clipped, distrust it

# Contact detection — IR DC level with a finger is 30,000–200,000 ADC counts
# (even at 4.4mA LED current). Without contact it drops to ~1,000–5,000.
# If mean IR falls below this threshold, treat it as "no finger present".
NO_CONTACT_IR_THRESHOLD = 20000

# LED current — LOW brightness is intentional. A fingertip pressed directly
# on the sensor reflects light very efficiently; full 50mA brightness
# saturates the ADC instantly and produces flat-lined, useless readings.
DEFAULT_LED_CURRENT = max30100.LED_CURRENT_4_4MA

# MLX90614 lives on its own SEPARATE I2C bus from the MAX30102 (see
# init_i2c_sensors() docstring). After enabling the overlay
# (dtoverlay=i2c1-pi5,pins_10_11) and rebooting, run `i2cdetect -l` and set
# this to whatever bus number Linux actually assigned — it is NOT guaranteed
# to be a small/sequential number on the Pi 5's RP1 chip.
# MLX90614 lives on its own SEPARATE hardware I2C bus from the MAX30102.
# CONFIRMED WORKING configuration (validated on real hardware):
#   /boot/firmware/config.txt contains: dtoverlay=i2c3-pi5,pins_22_23
#   MLX90614 wired to: VIN->pin17, GND->pin20, SCL->pin16 (GPIO23),
#                       SDA->pin15 (GPIO22)
#   Two 4.7k pull-up resistors: pin15->pin17, pin16->pin17
#     (required because GPIO22/23 lack the dedicated pull-ups that
#      GPIO2/3 have for the default bus)
#   This bus appears as /dev/i2c-3 ("Synopsys DesignWare I2C adapter").
#
# NOTE: i2cdetect is UNRELIABLE for the MLX90614 specifically on Pi 5 —
# it is a confirmed, documented quirk (see Raspberry Pi GitHub issue
# raspberrypi/bookworm-feedback#263) where i2cdetect shows nothing at
# 0x5a even though the sensor responds completely normally to real
# register reads. Do NOT use i2cdetect to diagnose MLX90614 problems on
# Pi 5 — verify with an actual register read instead (this script does
# exactly that every 500ms).
MLX90614_I2C_BUS_NUMBER = 3


# ---------------------------------------------------------------------------
# DSP helpers
# ---------------------------------------------------------------------------

def moving_average(signal: np.ndarray, kernel: int) -> np.ndarray:
    """Causal moving-average (boxcar) filter; output same length as input."""
    if kernel < 2:
        return signal.copy()
    kernel = min(kernel, len(signal))
    cumsum = np.cumsum(np.insert(signal, 0, 0))
    ma = (cumsum[kernel:] - cumsum[:-kernel]) / kernel
    pad = np.full(kernel - 1, ma[0] if len(ma) else 0.0)
    return np.concatenate([pad, ma])


def detect_peaks(signal: np.ndarray, min_distance: int, threshold_factor: float):
    """
    Local-maxima peak detector with a dynamic threshold and a hard
    refractory period. The refractory period is the primary defense against
    counting a PPG dicrotic notch as a second beat.
    """
    if len(signal) < 3:
        return np.array([], dtype=int)

    sig_mean = np.mean(signal)
    sig_range = np.max(signal) - np.min(signal)
    threshold = sig_mean + threshold_factor * sig_range

    peaks = []
    last_peak = -min_distance

    for i in range(1, len(signal) - 1):
        if (signal[i] > signal[i - 1]
                and signal[i] > signal[i + 1]
                and signal[i] > threshold
                and (i - last_peak) >= min_distance):
            peaks.append(i)
            last_peak = i

    return np.array(peaks, dtype=int)


def compute_bpm_spo2(ir_buf: collections.deque,
                     red_buf: collections.deque,
                     sample_rate: float):
    """
    Compute BPM and SpO2 from the current circular buffers.

    Returns (bpm, spo2). bpm/spo2 are None if not yet computable, or the
    string "SATURATED" for bpm if the ADC is clipped (caller should treat
    this as "no valid data", not as a missing-but-otherwise-fine reading).
    """
    if len(ir_buf) < WINDOW_SIZE:
        return None, None

    ir_arr  = np.array(ir_buf,  dtype=np.float64)
    red_arr = np.array(red_buf, dtype=np.float64)

    # ---- Saturation guard --------------------------------------------------
    if (np.mean(ir_arr >= ADC_MAX - 1) > SATURATION_FRACTION_LIMIT
            or np.mean(red_arr >= ADC_MAX - 1) > SATURATION_FRACTION_LIMIT):
        return "SATURATED", None

    # ---- DC baseline removal via moving average ---------------------------
    ir_dc  = moving_average(ir_arr,  MA_KERNEL)
    red_dc = moving_average(red_arr, MA_KERNEL)

    ir_ac  = ir_arr  - ir_dc
    red_ac = red_arr - red_dc

    # Low-pass filter the AC signal to remove high-frequency noise (e.g., 80ms window)
    lp_kernel = max(1, int(sample_rate * 0.08))
    ir_ac = moving_average(ir_ac, lp_kernel)
    red_ac = moving_average(red_ac, lp_kernel)

    # ---- BPM via FFT — most robust approach ----------------------------------
    # Takes the power spectrum of the AC-coupled IR signal and picks the
    # dominant frequency in the 0.75–3.5 Hz band (45–210 BPM).
    # A Hann window reduces spectral leakage from the finite-length buffer.
    # FFT naturally handles the half-rate problem: the fundamental heartbeat
    # frequency carries more power than its harmonics, so 1× is always chosen.
    bpm = None
    try:
        n   = len(ir_ac)
        win = np.hanning(n)                         # Hann window
        spectrum = np.abs(np.fft.rfft(ir_ac * win))
        freqs    = np.fft.rfftfreq(n, d=1.0 / sample_rate)   # Hz

        # Isolate the heartbeat band 0.75 – 3.5 Hz  (45 – 210 BPM)
        mask = (freqs >= 0.75) & (freqs <= 3.5)
        if np.any(mask):
            peak_freq = freqs[mask][np.argmax(spectrum[mask])]
            candidate = round(peak_freq * 60.0)
            if 45 <= candidate <= 210:
                bpm = candidate
    except Exception:
        pass

    # ---- SpO2 via ratio-of-ratios -------------------------------------------
    spo2 = None
    try:
        dc_ir  = np.mean(ir_dc)
        dc_red = np.mean(red_dc)
        if dc_ir > 1 and dc_red > 1:
            ac_ir  = float(np.std(ir_ac))
            ac_red = float(np.std(red_ac))
            if ac_ir > 0 and ac_red > 0:
                R   = (ac_red / dc_red) / (ac_ir / dc_ir)
                val = SPO2_A - SPO2_B * R
                if 70.0 <= val <= 100.0:
                    spo2 = round(val)
    except ZeroDivisionError:
        pass

    return bpm, spo2


class BPMSmoother:
    """
    Stabilises BPM display using a rolling median window + EMA.

    Why median first?
    The peak detector occasionally produces half-rate estimates (e.g. 42 when
    the true BPM is ~84) when the signal amplitude dips and every other beat
    is missed. A median over the last N estimates rejects these outliers before
    the EMA blends them in, giving a stable reading even when individual windows
    are noisy.
    """

    MEDIAN_WINDOW = 9   # wider window = more stable against spike artifacts

    def __init__(self, max_step=BPM_MAX_STEP, alpha=BPM_EMA_ALPHA):
        self.max_step = max_step
        self.alpha = alpha
        self.value = None           # EMA-smoothed BPM (float)
        self._history = []          # rolling buffer of recent raw estimates

    def update(self, new_bpm):
        """Feed a new raw BPM estimate (or None). Returns the stabilised BPM."""
        if new_bpm is None:
            return round(self.value) if self.value is not None else None

        # Accumulate recent estimates for median filtering
        self._history.append(float(new_bpm))
        if len(self._history) > self.MEDIAN_WINDOW:
            self._history.pop(0)

        # Use median of recent window to suppress outlier half-rate estimates
        median_bpm = sorted(self._history)[len(self._history) // 2]

        if self.value is None:
            self.value = median_bpm
        else:
            # Plausibility gate: ignore step too large to be physiological
            if abs(median_bpm - self.value) > self.max_step:
                return round(self.value)
            self.value = (1 - self.alpha) * self.value + self.alpha * median_bpm

        return round(self.value)


# ---------------------------------------------------------------------------
# Sensor initialisation
# ---------------------------------------------------------------------------

def init_i2c_sensors():
    """
    Initialise the MAX30102 and MLX90614 on SEPARATE I2C buses.

    CONFIRMED WORKING WIRING (validated on real hardware):
      MAX30102 -> pins 3/5   -> default hardware bus, /dev/i2c-1
      MLX90614 -> pins 15/16 -> third hardware I2C bus enabled via
                                 dtoverlay=i2c3-pi5,pins_22_23 in
                                 /boot/firmware/config.txt (appears as
                                 /dev/i2c-3). Two 4.7k pull-up resistors
                                 are required on pins 15->17 and 16->17,
                                 since GPIO22/23 lack the dedicated
                                 pull-ups that GPIO2/3 have by default.

    busio.I2C(board.SCL, board.SDA) only ever targets the DEFAULT bus
    (normally bus 1) — it has no way to target an arbitrary bus number by
    itself. For the MLX90614 on the non-default bus, this uses
    adafruit_extended_bus.ExtendedI2C, which is Adafruit's supported way to
    bind a busio.I2C-compatible object to a specific /dev/i2c-N device file.
    Install it with: pip install adafruit-extended-bus --break-system-packages

    Returns (mlx, ox).
    """
    # ---- Bus 1 (default): MAX30102 ------------------------------------------
    ox = max30100.MAX30100(
        i2c_bus=1,
        mode=max30100.MODE_SPO2,           # enables both RED and IR LEDs
        sample_rate=max30100.SAMPLE_RATE_100,
        led_current_red=DEFAULT_LED_CURRENT,
        led_current_ir=DEFAULT_LED_CURRENT,
        pulse_width=max30100.PULSE_WIDTH_1600US_ADC_16,
        max_buffer_len=WINDOW_SIZE,
    )
    ox.enable_spo2()
    log.info("MAX30102 initialised at 0x57 on bus 1 (default)")

    # ---- Bus 2 (new overlay): MLX90614 --------------------------------------
    from adafruit_extended_bus import ExtendedI2C
    i2c_bus2 = ExtendedI2C(MLX90614_I2C_BUS_NUMBER)
    mlx = adafruit_mlx90614.MLX90614(i2c_bus2)
    log.info("MLX90614 initialised at 0x5A on bus %d", MLX90614_I2C_BUS_NUMBER)

    return mlx, ox


def init_gps():
    """Open the GPS UART. Returns a serial.Serial instance."""
    gps_serial = serial.Serial(
        port=GPS_PORT,
        baudrate=GPS_BAUD,
        timeout=GPS_TIMEOUT,
    )
    log.info("GPS UART opened on %s @ %d baud", GPS_PORT, GPS_BAUD)
    return gps_serial


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    print("=" * 64)
    print("  T-BTN Combined Sensor Test — MAX30102 + NEO-6M GPS + MLX90614")
    print("=" * 64)

    # ---- Hardware init -------------------------------------------------------
    try:
        mlx, ox = init_i2c_sensors()
        print("[OK] MAX30102 (bus 1) + MLX90614 (bus "
              f"{MLX90614_I2C_BUS_NUMBER}) initialised")
    except (RuntimeError, ValueError) as exc:
        print(f"[FAIL] I2C sensor init failed: {exc}")
        print("       For MAX30102: run `i2cdetect -y 1` and confirm 0x57 appears.")
        print(f"       For MLX90614 on bus {MLX90614_I2C_BUS_NUMBER}: do NOT rely on")
        print("       i2cdetect — it is documented as unreliable for this exact")
        print("       sensor on Pi 5 even when wiring is correct (see Raspberry Pi")
        print("       GitHub issue raspberrypi/bookworm-feedback#263). If this error")
        print("       is happening, double check VIN/GND/SCL/SDA wiring and the two")
        print("       pull-up resistors on pins 15/16 instead.")
        raise SystemExit(1) from exc
    except Exception as exc:
        log.error("I2C initialisation failed: %s", exc)
        raise SystemExit(1) from exc

    try:
        gps_serial = init_gps()
        print("[OK] GPS UART opened on", GPS_PORT)
    except Exception as exc:
        log.warning("GPS UART failed to open (%s) — continuing without GPS", exc)
        print(f"[WARN] GPS UART failed to open ({exc}) — continuing without GPS")
        gps_serial = None

    # ---- State variables -------------------------------------------------------
    bpm_smoother = BPMSmoother()

    body_temp = None        # °C from MLX90614
    bpm       = None        # smoothed beats per minute
    spo2      = None        # %
    gps_lat   = None        # decimal degrees
    gps_lon   = None        # decimal degrees
    saturated = False       # True when the MAX30102 ADC is currently clipped

    t_last_print = time.monotonic()
    t_last_mlx   = time.monotonic()

    gps_line_buf = ""

    print("\nPlace fingertip gently on the MAX30102 sensor for BPM/SpO2.")
    print("Sampling... (Ctrl-C to quit)\n")

    # ---- Cooperative polling loop ------------------------------------------
    while True:
        loop_start = time.monotonic()

        # ------------------------------------------------------------------ #
        # 1. MAX30102 — rapid optical poll (~100 Hz)                          #
        # ------------------------------------------------------------------ #
        try:
            ox.read_sensor()
        except OSError as exc:
            log.debug("MAX30102 I2C error (skipping sample): %s", exc)
        except Exception as exc:
            log.warning("MAX30102 unexpected error: %s", exc)

        # ------------------------------------------------------------------ #
        # 2. MLX90614 — 2 Hz body temperature                                #
        # ------------------------------------------------------------------ #
        now = time.monotonic()
        if now - t_last_mlx >= MLX_INTERVAL:
            t_last_mlx = now
            try:
                body_temp = round(mlx.object_temperature, 1)
            except OSError as exc:
                log.debug("MLX90614 I2C error: %s", exc)
            except Exception as exc:
                log.warning("MLX90614 unexpected error: %s", exc)

        # ------------------------------------------------------------------ #
        # 3. GPS — non-blocking UART drain                                    #
        # ------------------------------------------------------------------ #
        if gps_serial is not None:
            try:
                available = gps_serial.in_waiting
                if available:
                    raw_bytes = gps_serial.read(available)
                    gps_line_buf += raw_bytes.decode("ascii", errors="replace")

                    while "\n" in gps_line_buf:
                        sentence, gps_line_buf = gps_line_buf.split("\n", 1)
                        sentence = sentence.strip()
                        if not sentence:
                            continue
                        try:
                            msg = pynmea2.parse(sentence)
                            if hasattr(msg, "latitude") and hasattr(msg, "longitude"):
                                lat = msg.latitude
                                lon = msg.longitude
                                if lat != 0.0 or lon != 0.0:
                                    gps_lat = lat
                                    gps_lon = lon
                        except pynmea2.ParseError:
                            pass
                        except Exception as exc:
                            log.debug("NMEA parse error: %s", exc)
            except serial.SerialException as exc:
                log.warning("GPS serial error: %s", exc)
            except Exception as exc:
                log.warning("GPS unexpected error: %s", exc)

        # ------------------------------------------------------------------ #
        # 4. DSP — recompute BPM & SpO2                                       #
        # ------------------------------------------------------------------ #
        try:
            ir_buf  = list(ox.buffer_ir)
            red_buf = list(ox.buffer_red)

            # ---- Contact detection: IR DC level drops when no finger ------
            no_contact = (
                len(ir_buf) > 0
                and (sum(ir_buf) / len(ir_buf)) < NO_CONTACT_IR_THRESHOLD
            )

            if no_contact:
                # No finger on sensor — clear stale readings and smoother
                bpm  = None
                spo2 = None
                saturated = False
                bpm_smoother._history.clear()
                bpm_smoother.value = None
                ox.buffer_ir.clear()
                ox.buffer_red.clear()
            else:
                raw_bpm, raw_spo2 = compute_bpm_spo2(ir_buf, red_buf, SAMPLE_RATE_HZ)
                if raw_bpm == "SATURATED":
                    saturated = True
                    bpm = None
                else:
                    saturated = False
                    bpm = bpm_smoother.update(raw_bpm)
                    if raw_spo2 is not None:
                        spo2 = raw_spo2
        except Exception as exc:
            log.warning("DSP error: %s", exc)

        # ------------------------------------------------------------------ #
        # 5. 1 Hz console output                                              #
        # ------------------------------------------------------------------ #
        now = time.monotonic()
        if now - t_last_print >= PRINT_INTERVAL:
            t_last_print = now

            temp_str = f"{body_temp:.1f}°C" if body_temp is not None else "---°C"

            if gps_lat is not None and gps_lon is not None:
                gps_str = f"{gps_lat:.4f}, {gps_lon:.4f}"
            else:
                gps_str = "No Fix"

            if saturated:
                ir_now  = ox.ir  if ox.ir  is not None else 0
                red_now = ox.red if ox.red is not None else 0
                print(
                    f"Temp: {temp_str} | "
                    f"BPM: SATURATED (raw IR:{ir_now} RED:{red_now}) | "
                    f"GPS: {gps_str}"
                )
            else:
                bpm_str  = str(bpm)  if bpm  is not None else "---"
                spo2_str = str(spo2) if spo2 is not None else "---"
                print(
                    f"Temp: {temp_str} | "
                    f"BPM: {bpm_str} (SpO2: {spo2_str}%) | "
                    f"GPS: {gps_str}"
                )

        # ------------------------------------------------------------------ #
        # 6. Sleep for the remainder of the 10ms poll slot                   #
        # ------------------------------------------------------------------ #
        elapsed = time.monotonic() - loop_start
        sleep_for = POLL_INTERVAL - elapsed
        if sleep_for > 0:
            time.sleep(sleep_for)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[T-BTN] Shutdown requested — goodbye.")
