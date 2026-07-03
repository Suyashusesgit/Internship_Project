#!/usr/bin/env python3
"""
T-BTN Army Dog — Firebase Simulator
=====================================
Pushes realistic fake sensor readings to Firestore so the dashboard
shows live data during a demo even when the Pi is not connected.

Usage (on your laptop):
    pip install firebase-admin          # one-time
    python simulator.py                 # normal mode
    python simulator.py --demo-critical # triggers CRITICAL alert after 90s
    python simulator.py --device tbtn-002 --interval 5
"""

import argparse
import math
import random
import sys
import time

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("ERROR: firebase-admin not installed. Run: pip install firebase-admin")
    sys.exit(1)

DEVICE_ID        = "tbtn-001"
PUBLISH_INTERVAL = 15.0

BASELINE = {"bpm": 95.0, "temp": 38.5, "spo2": 97.0}

# Patrol route: small loop (New Delhi demo area)
PATROL_WAYPOINTS = [
    (28.6315, 77.2167), (28.6320, 77.2195), (28.6335, 77.2210),
    (28.6350, 77.2215), (28.6355, 77.2195), (28.6345, 77.2175),
    (28.6330, 77.2162), (28.6315, 77.2167),
]


def _drift(value, target, sigma, lo, hi):
    value += (target - value) * 0.05
    value += random.gauss(0, sigma)
    return max(lo, min(hi, value))


class DogState:
    def __init__(self, device_id):
        self.device_id = device_id
        self.bpm = BASELINE["bpm"]
        self.temp = BASELINE["temp"]
        self.spo2 = BASELINE["spo2"]
        self.waypoint = 0
        self.progress = 0.0
        self.elapsed = 0
        self.speed_kmh = 6.0

    def next_vitals(self, demo_critical=False, interval=PUBLISH_INTERVAL):
        self.elapsed += interval
        exertion = min(1.0, self.elapsed / 300.0)
        self.bpm  = _drift(self.bpm,  BASELINE["bpm"]  + exertion * 15, 3.0, 45, 200)
        self.temp = _drift(self.temp, BASELINE["temp"]  + exertion * 0.4, 0.1, 37.0, 41.0)
        self.spo2 = _drift(self.spo2, BASELINE["spo2"] - exertion * 0.5, 0.3, 88.0, 100.0)

        if demo_critical and self.elapsed >= 90:
            self.bpm  = random.uniform(205, 215)
            self.spo2 = random.uniform(87, 89)

        lat, lon  = self._gps_pos(interval)
        heading   = self._heading()
        speed     = max(0.0, self.speed_kmh + random.gauss(0, 0.5))

        return {
            "deviceId":      self.device_id,
            "bpm":           round(self.bpm, 1),
            "temp":          round(self.temp, 2),
            "spo2":          round(self.spo2, 1),
            "lat":           round(lat, 7),
            "lon":           round(lon, 7),
            "speedKmh":      round(speed, 1),
            "heading":       round(heading, 1),
            "throttleFlags": 0,
        }

    def _gps_pos(self, interval):
        curr = PATROL_WAYPOINTS[self.waypoint % len(PATROL_WAYPOINTS)]
        nxt  = PATROL_WAYPOINTS[(self.waypoint + 1) % len(PATROL_WAYPOINTS)]
        self.progress += interval / 60.0
        if self.progress >= 1.0:
            self.progress = 0.0
            self.waypoint = (self.waypoint + 1) % (len(PATROL_WAYPOINTS) - 1)
        t = self.progress
        lat = curr[0] + t * (nxt[0] - curr[0]) + random.gauss(0, 0.000008)
        lon = curr[1] + t * (nxt[1] - curr[1]) + random.gauss(0, 0.000008)
        return lat, lon

    def _heading(self):
        curr = PATROL_WAYPOINTS[self.waypoint % len(PATROL_WAYPOINTS)]
        nxt  = PATROL_WAYPOINTS[(self.waypoint + 1) % len(PATROL_WAYPOINTS)]
        return math.degrees(math.atan2(nxt[1] - curr[1], nxt[0] - curr[0])) % 360


def init_firebase(key_path):
    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)
    return firestore.client()


def push_reading(db, data):
    from google.cloud.firestore_v1 import SERVER_TIMESTAMP
    data["timestamp"] = SERVER_TIMESTAMP
    db.collection("readings").add(data)
    status = "🔴 CRITICAL" if (data["bpm"] > 200 or data["spo2"] < 90) else "🟢 Normal"
    print(f"  [{status}] BPM={data['bpm']:.0f}  Temp={data['temp']:.1f}°C  "
          f"SpO2={data['spo2']:.0f}%  GPS=({data['lat']:.5f}, {data['lon']:.5f})  "
          f"Speed={data['speedKmh']}km/h  Heading={data['heading']}°")


def main():
    p = argparse.ArgumentParser(description="T-BTN Army Dog Firebase Simulator")
    p.add_argument("--key",           default="../serviceAccountKey.json")
    p.add_argument("--device",        default=DEVICE_ID)
    p.add_argument("--interval",      type=float, default=PUBLISH_INTERVAL)
    p.add_argument("--demo-critical", action="store_true",
                   help="Vitals go CRITICAL after 90s to demo the alert system")
    p.add_argument("--count",         type=int, default=0,
                   help="Number of readings then exit (0=forever)")
    args = p.parse_args()

    print("━" * 62)
    print("  T-BTN Army Dog — Firebase Simulator")
    print(f"  Device: {args.device}  |  Interval: {args.interval}s")
    if args.demo_critical:
        print("  ⚠️  DEMO-CRITICAL mode: vitals go CRITICAL after 90s")
    print("━" * 62)

    try:
        db = init_firebase(args.key)
        print("✅ Firebase connected\n")
    except Exception as e:
        print(f"❌ Firebase init failed: {e}")
        sys.exit(1)

    dog  = DogState(args.device)
    sent = 0
    try:
        while True:
            reading = dog.next_vitals(demo_critical=args.demo_critical, interval=args.interval)
            push_reading(db, reading)
            sent += 1
            if args.count and sent >= args.count:
                print(f"\n✅ Done — {sent} readings pushed.")
                break
            print(f"  ↳ sleeping {args.interval}s  (Ctrl+C to stop)\n")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print(f"\n⛔ Stopped. {sent} reading(s) pushed to Firestore.")


if __name__ == "__main__":
    main()
