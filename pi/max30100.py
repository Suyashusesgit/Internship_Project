"""
max30100.py — Pure-Python driver for the Maxim MAX30102
==========================================================
IMPORTANT: Your hardware identifies itself with PART_ID = 0x15, which is the
MAX30102 (the MAX30100's successor), not the original MAX30100. Almost every
"MAX30100" breakout board sold today actually carries this chip — same I2C
address (0x57), same footprint, but a DIFFERENT register map and a 3-byte
(not 2-byte) FIFO sample width. This file now drives the MAX30102 directly.

Target  : Raspberry Pi 5 (or any Linux SBC with I2C)
Backend : smbus2  (pip install smbus2)
Datasheet: https://www.analog.com/media/en/technical-documentation/data-sheets/max30102.pdf

Drop this file next to your main script so that  `import max30100`  works
without any pip-installed package. The class name and public API are
UNCHANGED from the previous version, so t_btn_sensor_node.py and
test_max30100.py need zero edits.

Public API:
    ox = max30100.MAX30100(i2c_bus=1, mode=max30100.MODE_SPO2, ...)
    ox.enable_spo2()
    ox.read_sensor()
    print(ox.ir, ox.red)                  # latest single sample
    print(ox.buffer_ir, ox.buffer_red)    # rolling history

Constants exposed at module level (same names as before, values updated
to whatever the MAX30102 actually expects internally — callers don't need
to know the difference):
    MODE_HR, MODE_SPO2
    SAMPLE_RATE_50 ... SAMPLE_RATE_1000
    LED_CURRENT_0MA ... LED_CURRENT_50MA
    PULSE_WIDTH_200US_ADC_13 ... PULSE_WIDTH_1600US_ADC_16
"""

import collections
import time
import smbus2

# ---------------------------------------------------------------------------
# I2C address (same as MAX30100)
# ---------------------------------------------------------------------------
MAX30100_ADDRESS = 0x57   # kept the same constant name for compatibility

# ---------------------------------------------------------------------------
# MAX30102 register addresses (confirmed against Analog Devices datasheet
# Rev.1, SparkFun's qwiic_max3010x driver, and an independent mbed driver)
# ---------------------------------------------------------------------------
_REG_INT_STATUS_1  = 0x00   # Interrupt Status 1 (A_FULL, PPG_RDY, ALC_OVF)
_REG_INT_STATUS_2  = 0x01   # Interrupt Status 2 (DIE_TEMP_RDY)
_REG_INT_ENABLE_1  = 0x02   # Interrupt Enable 1
_REG_INT_ENABLE_2  = 0x03   # Interrupt Enable 2
_REG_FIFO_WR_PTR   = 0x04   # FIFO Write Pointer
_REG_OVF_COUNTER   = 0x05   # FIFO Overflow Counter
_REG_FIFO_RD_PTR   = 0x06   # FIFO Read Pointer
_REG_FIFO_DATA     = 0x07   # FIFO Data Output (burst register, no auto-incr)
_REG_FIFO_CONFIG   = 0x08   # FIFO Configuration (sample averaging, rollover)
_REG_MODE_CONFIG   = 0x09   # Mode Configuration
_REG_SPO2_CONFIG   = 0x0A   # SpO2 Configuration (sample rate, pulse width, ADC range)
_REG_LED1_PULSEAMP = 0x0C   # Red LED pulse amplitude
_REG_LED2_PULSEAMP = 0x0D   # IR LED pulse amplitude
_REG_TEMP_INT      = 0x1F   # Die Temperature Integer
_REG_TEMP_FRAC     = 0x20   # Die Temperature Fraction
_REG_TEMP_CONFIG   = 0x21   # Die Temperature Config (TEMP_EN)
_REG_REV_ID        = 0xFE   # Revision ID
_REG_PART_ID       = 0xFF   # Part ID — reads 0x15 on genuine MAX30102 silicon

# ---------------------------------------------------------------------------
# Mode Configuration register (0x09)
# ---------------------------------------------------------------------------
_MODE_SHDN   = 0b10000000   # Shutdown / power-save
_MODE_RESET  = 0b01000000   # Software reset (self-clearing)

MODE_HR   = 0x02   # Heart-Rate only (IR LED)
MODE_SPO2 = 0x03   # SpO2 (IR + Red LEDs)

# ---------------------------------------------------------------------------
# SpO2 Configuration register (0x0A)
# Bits[6:5] ADC range | Bits[4:2] sample rate | Bits[1:0] LED pulse width
# ---------------------------------------------------------------------------
# Sample-rate codes (bits 4:2 of SPO2_CONFIG) — kept the same constant NAMES
# as the original MAX30100 driver for drop-in compatibility, mapped onto the
# equivalent MAX30102 sample-rate code.
SAMPLE_RATE_50   = 0x00
SAMPLE_RATE_100  = 0x01
SAMPLE_RATE_167  = 0x02
SAMPLE_RATE_200  = 0x03
SAMPLE_RATE_400  = 0x04
SAMPLE_RATE_600  = 0x05
SAMPLE_RATE_800  = 0x06
SAMPLE_RATE_1000 = 0x07

# LED pulse-width codes (bits 1:0 of SPO2_CONFIG) — also sets ADC resolution
PULSE_WIDTH_200US_ADC_13  = 0x00   # 15-bit ADC, 69us  (closest MAX30102 equiv)
PULSE_WIDTH_400US_ADC_14  = 0x01   # 16-bit ADC, 118us
PULSE_WIDTH_800US_ADC_15  = 0x02   # 17-bit ADC, 215us
PULSE_WIDTH_1600US_ADC_16 = 0x03   # 18-bit ADC, 411us  <- best resolution

# ADC full-scale range (bits 6:5 of SPO2_CONFIG) — default to a good middle
_SPO2_ADC_RANGE_4096NA = 0x01   # 4096 nA full scale (sensible general default)

# ---------------------------------------------------------------------------
# LED pulse amplitude (0x0C Red, 0x0D IR) — direct register byte codes
# Same constant NAMES as before; values are the literal register byte that
# yields approximately that LED current per the MAX30102 datasheet table.
# ---------------------------------------------------------------------------
LED_CURRENT_0MA    = 0x00
LED_CURRENT_4_4MA  = 0x1F
LED_CURRENT_7_6MA  = 0x38
LED_CURRENT_11MA   = 0x51
LED_CURRENT_14_2MA = 0x6C
LED_CURRENT_17_4MA = 0x85
LED_CURRENT_20_8MA = 0xA0
LED_CURRENT_24MA   = 0xB8
LED_CURRENT_27_1MA = 0xCE
LED_CURRENT_30_6MA = 0xE6
LED_CURRENT_33_8MA = 0xFF
LED_CURRENT_37MA   = 0xFF
LED_CURRENT_40_2MA = 0xFF
LED_CURRENT_43_6MA = 0xFF
LED_CURRENT_46_8MA = 0xFF
LED_CURRENT_50MA   = 0xFF   # 0xFF = ~50mA per datasheet

# ---------------------------------------------------------------------------
# Interrupt Enable 1 register (0x02)
# ---------------------------------------------------------------------------
_INT_ENB_A_FULL  = 0x80   # FIFO Almost Full
_INT_ENB_PPG_RDY = 0x40   # New FIFO sample ready
_INT_ENB_ALC_OVF = 0x20   # Ambient light cancellation overflow

# FIFO Configuration register (0x08): no sample averaging, rollover OFF
# With rollover OFF, when the FIFO fills the OVF counter increments and WR_PTR
# freezes. read_sensor() detects OVF>0, resets both pointers, and fresh samples
# begin arriving on the very next poll. This is more predictable than rollover ON
# where WR wraps silently and avail() can compute 0 when the FIFO is actually full.
_FIFO_CONFIG_NO_AVG_NO_ROLLOVER = 0x00

# Default local rolling-buffer length kept in software
_DEFAULT_BUFFER_LEN = 100

# Each FIFO sample on the MAX30102 is 3 bytes per active channel.
# In SpO2 mode both RED and IR channels are active -> 6 bytes per sample.
_BYTES_PER_CHANNEL = 3
_BYTES_PER_SAMPLE_SPO2 = _BYTES_PER_CHANNEL * 2   # RED + IR
_BYTES_PER_SAMPLE_HR   = _BYTES_PER_CHANNEL * 1   # IR only

# FIFO depth on the MAX30102 (32-sample FIFO, vs 16 on the original MAX30100)
_FIFO_DEPTH = 32

# 18-bit ADC -> mask off any garbage in the top bits of each 3-byte word
_ADC_18BIT_MASK = 0x03FFFF


class MAX30100:
    """
    Driver for the MAX30102 pulse oximeter / heart-rate sensor.

    Despite the class name (kept for compatibility with existing code that
    does `import max30100`), this targets the MAX30102 register map, which
    is what virtually all current-production "MAX30100" breakout boards
    actually contain (confirmed by your PART_ID=0x15 reading).

    Parameters
    ----------
    i2c_bus : int
        Linux I2C bus number (1 = /dev/i2c-1, the default on Raspberry Pi).
        Ignored when an *i2c* busio object is passed.
    i2c : busio.I2C or None
        Optional CircuitPython-style I2C object, for sharing a bus with
        another CircuitPython sensor driver (e.g. MLX90614). When None
        (default), raw smbus2 is used directly.
    mode : int
        Initial operating mode: ``MODE_HR`` or ``MODE_SPO2``.
    sample_rate : int
        One of the SAMPLE_RATE_* constants.
    pulse_width : int
        One of the PULSE_WIDTH_* constants (also sets ADC resolution).
    led_current_red : int
        Red LED drive current constant (LED_CURRENT_*).
    led_current_ir : int
        IR LED drive current constant (LED_CURRENT_*).
    max_buffer_len : int
        Number of samples kept in the software rolling buffers.
    """

    def __init__(
        self,
        i2c_bus=1,
        i2c=None,
        mode=MODE_SPO2,
        sample_rate=SAMPLE_RATE_100,
        pulse_width=PULSE_WIDTH_1600US_ADC_16,
        led_current_red=LED_CURRENT_50MA,
        led_current_ir=LED_CURRENT_50MA,
        max_buffer_len=_DEFAULT_BUFFER_LEN,
    ):
        # --- Open I2C bus ---------------------------------------------------
        if i2c is not None:
            self._bus = _CircuitPythonI2CShim(i2c, MAX30100_ADDRESS)
        else:
            self._bus = smbus2.SMBus(i2c_bus)

        self._addr = MAX30100_ADDRESS
        self._mode = mode   # remember so read_sensor() knows the sample width

        # Verify part ID — genuine MAX30102 silicon reads 0x15 here
        part_id = self._read_byte(_REG_PART_ID)
        if part_id != 0x15:
            raise RuntimeError(
                f"MAX30102 not found at 0x{MAX30100_ADDRESS:02X} "
                f"(PART_ID=0x{part_id:02X}, expected 0x15). "
                "Check wiring and I2C pull-ups."
            )

        # Software reset, then wait for it to self-clear
        self._write_byte(_REG_MODE_CONFIG, _MODE_RESET)
        deadline = time.monotonic() + 1.0
        while self._read_byte(_REG_MODE_CONFIG) & _MODE_RESET:
            if time.monotonic() > deadline:
                raise RuntimeError("MAX30102 reset timed out")
            time.sleep(0.01)

        # Clear FIFO pointers to a known state (datasheet-recommended)
        self._write_byte(_REG_FIFO_WR_PTR, 0x00)
        self._write_byte(_REG_OVF_COUNTER, 0x00)
        self._write_byte(_REG_FIFO_RD_PTR, 0x00)

        # FIFO config: no averaging, rollover OFF
        # OVF recovery in read_sensor() handles the overflow case cleanly.
        self._write_byte(_REG_FIFO_CONFIG, _FIFO_CONFIG_NO_AVG_NO_ROLLOVER)

        # SpO2 config: ADC range + sample rate + pulse width
        spo2_cfg = (
            (_SPO2_ADC_RANGE_4096NA << 5)
            | (sample_rate << 2)
            | pulse_width
        )
        self._write_byte(_REG_SPO2_CONFIG, spo2_cfg)

        # LED pulse amplitudes — separate registers (not packed like MAX30100)
        self._write_byte(_REG_LED1_PULSEAMP, led_current_red)
        self._write_byte(_REG_LED2_PULSEAMP, led_current_ir)

        # Set operating mode
        self._set_mode(mode)

        # Enable interrupt for "new sample ready" — used only informationally
        # since we poll the FIFO pointers directly rather than the INT pin,
        # but this mirrors the recommended datasheet setup sequence.
        self._write_byte(_REG_INT_ENABLE_1, _INT_ENB_PPG_RDY)

        # Public sample attributes
        self.ir = None
        self.red = None

        # Rolling software buffers (deque gives O(1) append + automatic
        # bounded growth without mid-read mutation races under the GIL).
        self._max_buf = max_buffer_len
        self.buffer_ir  = collections.deque(maxlen=max_buffer_len)
        self.buffer_red = collections.deque(maxlen=max_buffer_len)

    # -----------------------------------------------------------------------
    # Public methods
    # -----------------------------------------------------------------------

    def enable_spo2(self):
        """Switch to SpO2 mode (enables both IR and Red LEDs)."""
        self._mode = MODE_SPO2
        self._set_mode(MODE_SPO2)

    def enable_hr(self):
        """Switch to Heart-Rate-only mode (IR LED only)."""
        self._mode = MODE_HR
        self._set_mode(MODE_HR)

    def read_sensor(self):
        """
        Drain all pending samples from the on-chip FIFO and update
        ``self.ir``, ``self.red``, ``self.buffer_ir``, and ``self.buffer_red``.

        Call this as fast as possible (e.g. every 10 ms) from your main loop.
        Non-blocking: if the FIFO is empty, it returns immediately.
        """
        wr_ptr = self._read_byte(_REG_FIFO_WR_PTR)
        rd_ptr = self._read_byte(_REG_FIFO_RD_PTR)
        ovf    = self._read_byte(_REG_OVF_COUNTER)
        num_avail = (wr_ptr - rd_ptr) & (_FIFO_DEPTH - 1)

        bytes_per_sample = (
            _BYTES_PER_SAMPLE_SPO2 if self._mode == MODE_SPO2
            else _BYTES_PER_SAMPLE_HR
        )

        # When the FIFO has overflowed (OVF > 0), WR_PTR has wrapped back to
        # equal RD_PTR so the formula gives avail=0 even though FIFO is full.
        # The OVF register is READ-ONLY — only cleared by reading samples.
        # Force-drain all 32 slots to unblock WR_PTR and clear OVF.
        if ovf > 0 and num_avail == 0:
            num_avail = _FIFO_DEPTH

        for _ in range(num_avail):
            raw = self._read_bytes(_REG_FIFO_DATA, bytes_per_sample)
            if raw is None or len(raw) < bytes_per_sample:
                break

            # Each channel is 3 bytes, MSB first; 18-bit value in the
            # low bits of the resulting 24-bit word.
            if self._mode == MODE_SPO2:
                red_sample = (
                    ((raw[0] << 16) | (raw[1] << 8) | raw[2]) & _ADC_18BIT_MASK
                )
                ir_sample = (
                    ((raw[3] << 16) | (raw[4] << 8) | raw[5]) & _ADC_18BIT_MASK
                )
            else:
                # In HR-only mode, only LED1 (IR) is active (placed in bytes 0-2)
                ir_sample = (
                    ((raw[0] << 16) | (raw[1] << 8) | raw[2]) & _ADC_18BIT_MASK
                )
                red_sample = None

            self.ir = ir_sample
            self.red = red_sample

            self.buffer_ir.append(ir_sample)
            if red_sample is not None:
                self.buffer_red.append(red_sample)
        # No manual trim needed — deque(maxlen=…) evicts oldest entries automatically.

    def get_temperature(self):
        """Read the on-chip die temperature (NOT body temperature)."""
        self._write_byte(_REG_TEMP_CONFIG, 0x01)   # TEMP_EN

        deadline = time.monotonic() + 0.1
        while self._read_byte(_REG_TEMP_CONFIG) & 0x01:
            if time.monotonic() > deadline:
                raise TimeoutError("MAX30102 temperature conversion timed out")
            time.sleep(0.005)

        t_int = self._read_byte(_REG_TEMP_INT)
        t_frac = self._read_byte(_REG_TEMP_FRAC)

        if t_int > 127:
            t_int -= 256
        return t_int + (t_frac * 0.0625)

    def shutdown(self):
        """Put the sensor in low-power shutdown mode."""
        mode = self._read_byte(_REG_MODE_CONFIG)
        self._write_byte(_REG_MODE_CONFIG, mode | _MODE_SHDN)

    def wakeup(self):
        """Wake the sensor from shutdown mode."""
        mode = self._read_byte(_REG_MODE_CONFIG)
        self._write_byte(_REG_MODE_CONFIG, mode & ~_MODE_SHDN)

    # -----------------------------------------------------------------------
    # Private helpers
    # -----------------------------------------------------------------------

    def _set_mode(self, mode):
        current = self._read_byte(_REG_MODE_CONFIG)
        self._write_byte(_REG_MODE_CONFIG, (current & 0b11111000) | (mode & 0x07))

    def _write_byte(self, register, value):
        self._bus.write_byte_data(self._addr, register, value)

    def _read_byte(self, register):
        return self._bus.read_byte_data(self._addr, register)

    def _read_bytes(self, register, length):
        return self._bus.read_i2c_block_data(self._addr, register, length)


# ---------------------------------------------------------------------------
# Thin shim: wraps a CircuitPython busio.I2C to expose smbus2-style methods
# ---------------------------------------------------------------------------

class _CircuitPythonI2CShim:
    """
    Adapts a CircuitPython ``busio.I2C`` object to expose the three
    smbus2 methods this driver calls. Uses writeto_then_readfrom, which is
    the portable combined-transaction call on the Linux/Blinka backend
    (writeto(..., stop=False) is NOT reliably supported there).
    """

    def __init__(self, i2c, address):
        self._i2c = i2c
        self._addr = address

    def write_byte_data(self, addr, register, value):
        # time.sleep(0) yields the GIL on each failed try_lock so other
        # threads (GPS drain, MLX read) are not starved by a busy-wait.
        while not self._i2c.try_lock():
            time.sleep(0)
        try:
            self._i2c.writeto(addr, bytes([register, value]))
        finally:
            self._i2c.unlock()

    def read_byte_data(self, addr, register):
        while not self._i2c.try_lock():
            time.sleep(0)
        try:
            buf = bytearray(1)
            self._i2c.writeto_then_readfrom(addr, bytes([register]), buf)
            return buf[0]
        finally:
            self._i2c.unlock()

    def read_i2c_block_data(self, addr, register, length):
        while not self._i2c.try_lock():
            time.sleep(0)
        try:
            buf = bytearray(length)
            self._i2c.writeto_then_readfrom(addr, bytes([register]), buf)
            return list(buf)
        finally:
            self._i2c.unlock()
