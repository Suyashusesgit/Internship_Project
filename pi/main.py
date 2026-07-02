#!/usr/bin/env python3
"""
T-BTN Wearable — Pi Data Collector
Sensors  : MAX30102 (BPM + SpO2) | MLX90614 (Temp) | NEO-6M/8M (GPS)
Writes to: Firebase Firestore every INTERVAL seconds
"""

import time
import logging
import json
import os
import math

# ── Sensor libraries ──────────────────────────────────────────────────────────
import board
import busio
import adafruit_mlx90614          # pip install adafruit-circuitpython-mlx90614
import max30102                    # pip install max30102
import serial                      # pip install pyserial
import pynmea2                     # pip install pynmea2

# ── Firebase ──────────────────────────────────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, firestore

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG — edit these values
# ─────────────────────────────────────────────────────────────────────────────
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
DEVICE_ID            = "tbtn-001"          # must match dashboard KNOWN_DEVICES
INTERVAL             = 15                  # seconds between Firestore writes
GPS_PORT             = "/dev/ttyAMA0"      # UART port for NEO-6M/8M
GPS_BAUD             = 9600
GPS_TIMEOUT          = 5                   # seconds to wait for a GPS fix per cycle

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "tbtn.log")),
    ],
)
log = logging.getLogger("tbtn")

# ─────────────────────────────────────────────────────────────────────────────
# Firebase init
# ─────────────────────────────────────────────────────────────────────────────
def init_firebase():
    cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)
    return firestore.client()

# ─────────────────────────────────────────────────────────────────────────────
# Sensor helpers
# ─────────────────────────────────────────────────────────────────────────────

def read_temperature(mlx) -> float | None:
    """Read object temperature from MLX90614 in Celsius."""
    try:
        return round(mlx.object_temperature, 2)
    except Exception as e:
        log.warning(f"MLX90614 read failed: {e}")
        return None


def read_max30102(sensor) -> tuple[int | None, int | None]:
    """
    Read BPM and SpO2 from MAX30102.
    Returns (bpm, spo2) — values are None on failure.
    """
    try:
        sensor.check_sensor_config()
        red_buffer   = []
        ir_buffer    = []
        sample_count = 100   # ~4 seconds at 25 sps

        for _ in range(sample_count):
            red, ir = sensor.read_sequential()
            red_buffer.append(red)
            ir_buffer.append(ir)
            time.sleep(0.04)

        bpm, valid_bpm, spo2, valid_spo2 = sensor.calculate_heart_rate_and_spo2(
            ir_buffer, red_buffer
        )

        bpm_out  = round(bpm)  if valid_bpm  and 20 < bpm  < 250 else None
        spo2_out = round(spo2) if valid_spo2 and 50 < spo2 <= 100 else None
        return bpm_out, spo2_out

    except Exception as e:
        log.warning(f"MAX30102 read failed: {e}")
        return None, None


def read_gps(port: str, baud: int, timeout: int) -> tuple[float | None, float | None]:
    """
    Open the GPS serial port and read lines until a valid GGA/RMC fix or timeout.
    Returns (lat, lon) in decimal degrees, or (None, None).
    """
    try:
        with serial.Serial(port, baud, timeout=1) as ser:
            deadline = time.time() + timeout
            while time.time() < deadline:
                raw = ser.readline().decode("ascii", errors="replace").strip()
                if not raw.startswith("$"):
                    continue
                try:
                    msg = pynmea2.parse(raw)
                    if hasattr(msg, "latitude") and hasattr(msg, "longitude"):
                        lat = msg.latitude
                        lon = msg.longitude
                        if lat and lon and not (math.isnan(lat) or math.isnan(lon)):
                            return round(lat, 6), round(lon, 6)
                except pynmea2.ParseError:
                    continue
    except serial.SerialException as e:
        log.warning(f"GPS serial error: {e}")
    return None, None

# ─────────────────────────────────────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────────────────────────────────────

def main():
    log.info("=== T-BTN wearable starting ===")

    # Firebase
    db = init_firebase()
    readings_col = db.collection("readings")

    # I2C bus
    i2c = busio.I2C(board.SCL, board.SDA)

    # MLX90614 (temp)
    mlx = adafruit_mlx90614.MLX90614(i2c)
    log.info("MLX90614 ready")

    # MAX30102 (BPM + SpO2)
    hr_sensor = max30102.MAX30102()
    log.info("MAX30102 ready")

    log.info(f"Writing to Firestore every {INTERVAL}s  device={DEVICE_ID}")

    while True:
        loop_start = time.time()

        temp          = read_temperature(mlx)
        bpm, spo2     = read_max30102(hr_sensor)
        lat, lon      = read_gps(GPS_PORT, GPS_BAUD, GPS_TIMEOUT)

        doc = {
            "deviceId"  : DEVICE_ID,
            "timestamp" : firestore.SERVER_TIMESTAMP,
            "temp"      : temp,
            "bpm"       : bpm,
            "spo2"      : spo2,
            "lat"       : lat,
            "lon"       : lon,
        }

        try:
            readings_col.add(doc)
            log.info(f"Wrote → temp={temp}°C  bpm={bpm}  spo2={spo2}%  gps=({lat},{lon})")
        except Exception as e:
            log.error(f"Firestore write failed: {e}")

        # Sleep for the remainder of the interval
        elapsed = time.time() - loop_start
        sleep_time = max(0, INTERVAL - elapsed)
        time.sleep(sleep_time)


if __name__ == "__main__":
    main()
