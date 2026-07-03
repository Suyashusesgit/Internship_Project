"""
buffer.py — Offline-first SQLite buffer for T-BTN Army Dog Wearable
=====================================================================
When the Pi has no internet, all sensor readings are saved here.
When internet returns, firebase_client.py flushes them to Firestore.

Schema
------
Table: readings
  id          INTEGER PRIMARY KEY AUTOINCREMENT
  device_id   TEXT
  temp        REAL
  bpm         REAL
  spo2        REAL
  lat         REAL
  lon         REAL
  recorded_at TEXT     -- ISO-8601 UTC string (used as Firestore timestamp)
  synced      INTEGER  -- 0 = pending, 1 = uploaded to Firestore
"""

import sqlite3
import threading
from datetime import datetime, timezone, timedelta

DB_PATH = "buffer.db"
_lock = threading.Lock()


def _get_conn():
    """Return a thread-local SQLite connection with WAL mode for concurrency."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn


def init_db():
    """Create the readings table if it does not exist."""
    with _lock:
        conn = _get_conn()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS readings (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id   TEXT,
                temp        REAL,
                bpm         REAL,
                spo2        REAL,
                lat         REAL,
                lon         REAL,
                speed_kmh   REAL,
                heading     REAL,
                recorded_at TEXT,
                synced      INTEGER DEFAULT 0
            )
        """)
        # Add columns if upgrading from an older schema (idempotent)
        for col, typedef in [("speed_kmh", "REAL"), ("heading", "REAL")]:
            try:
                conn.execute(f"ALTER TABLE readings ADD COLUMN {col} {typedef}")
            except Exception:
                pass  # Column already exists
        conn.commit()
        conn.close()
    print(f"[Buffer] SQLite buffer ready at '{DB_PATH}'")


def save(reading: dict):
    """
    Persist a single reading dict to local SQLite.
    Called every time a reading is captured, regardless of internet state.

    Expected keys: device_id, temp, bpm, spo2, lat, lon, speedKmh, heading
    """
    now_utc = datetime.now(timezone.utc).isoformat()
    with _lock:
        conn = _get_conn()
        conn.execute(
            """
            INSERT INTO readings (device_id, temp, bpm, spo2, lat, lon, speed_kmh, heading, recorded_at, synced)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            """,
            (
                reading.get("deviceId"),
                reading.get("temp"),
                reading.get("bpm"),
                reading.get("spo2"),
                reading.get("lat"),
                reading.get("lon"),
                reading.get("speedKmh"),
                reading.get("heading"),
                now_utc,
            ),
        )
        conn.commit()
        conn.close()


def get_pending(limit: int = 50) -> list[dict]:
    """
    Return up to `limit` unsynced readings, oldest first.
    Returns a list of dicts ready to be uploaded to Firestore.
    """
    with _lock:
        conn = _get_conn()
        rows = conn.execute(
            "SELECT * FROM readings WHERE synced = 0 ORDER BY id ASC LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
    return [dict(row) for row in rows]


def mark_synced(ids: list[int]):
    """Mark a list of row IDs as uploaded (synced = 1)."""
    if not ids:
        return
    placeholders = ",".join("?" * len(ids))
    with _lock:
        conn = _get_conn()
        conn.execute(
            f"UPDATE readings SET synced = 1 WHERE id IN ({placeholders})", ids
        )
        conn.commit()
        conn.close()


def pending_count() -> int:
    """Return the number of readings waiting to be uploaded."""
    with _lock:
        conn = _get_conn()
        count = conn.execute(
            "SELECT COUNT(*) FROM readings WHERE synced = 0"
        ).fetchone()[0]
        conn.close()
    return count


def cleanup_synced(keep_days: int = 7):
    """
    P3: Delete synced records older than keep_days to prevent unbounded SD card growth.
    Called automatically after each successful Firestore flush.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=keep_days)).isoformat()
    with _lock:
        conn = _get_conn()
        deleted = conn.execute(
            "DELETE FROM readings WHERE synced = 1 AND recorded_at < ?", (cutoff,)
        ).rowcount
        conn.commit()
        conn.close()
    if deleted:
        print(f"[Buffer] Cleaned up {deleted} old synced record(s) (>{keep_days} days).")
