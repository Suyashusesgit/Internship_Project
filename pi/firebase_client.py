"""
firebase_client.py — Offline-first Firebase client for T-BTN Army Dog Wearable
================================================================================
How it works
------------
1. Every reading is ALWAYS saved to local SQLite (buffer.py) first.
2. A background flush thread runs every FLUSH_INTERVAL_SEC seconds.
3. When internet is available, it uploads all pending buffered readings to
   Firestore, then marks them as synced.
4. When offline, buffered readings stay in SQLite until connectivity returns.

This means NO DATA IS LOST even if the hotspot or 4G dongle drops mid-field.

Connectivity
------------
Works transparently with:
  - Mobile hotspot (soldier's phone)
  - USB 4G LTE dongle (Jio, Airtel, Huawei E3372, etc.)
  - Home / base Wi-Fi
The connectivity check is network-agnostic — it just tests if the internet
is reachable, regardless of which interface carries it.
"""

import threading
import time
import logging

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

import buffer
from connectivity import has_internet

log = logging.getLogger("T-BTN.firebase")

# How often the flush thread tries to upload pending buffered readings
FLUSH_INTERVAL_SEC = 30

# Max readings to upload in one flush batch (avoid overloading on reconnect)
FLUSH_BATCH_SIZE = 50


class FirebaseClient:
    """
    Offline-first Firestore client.

    On init:
      - Initialises the local SQLite buffer.
      - Attempts to connect to Firebase (retries for up to 120s at boot).
      - Starts a background flush thread.

    On publish_reading():
      - Always saves to local buffer first.
      - Immediately attempts a flush if online.
    """

    def __init__(self, key_path: str = "serviceAccountKey.json"):
        self.db = None
        self._stop_event = threading.Event()

        # 1. Initialise the local buffer (always works, no network needed)
        buffer.init_db()

        # 2. Try to connect to Firebase with retries
        self._init_firebase(key_path)

        # 3. Start background flush thread
        self._flush_thread = threading.Thread(
            target=self._flush_loop, daemon=True, name="FirebaseFlushThread"
        )
        self._flush_thread.start()
        log.info("[Firebase] Background flush thread started (every %ds).", FLUSH_INTERVAL_SEC)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def publish_reading(self, reading_data: dict):
        """
        Save a reading locally, then try to upload any pending readings.

        `reading_data` must have keys: deviceId, temp, bpm, spo2, lat, lon
        """
        # Step 1: Always save locally first (never loses data)
        buffer.save(reading_data)
        pending = buffer.pending_count()
        log.debug("[Buffer] Saved locally. Pending uploads: %d", pending)

        # Step 2: If online, flush immediately (don't wait for the timer)
        if has_internet():
            self._flush_pending()
        else:
            log.warning(
                "[Firebase] Offline — reading saved locally. "
                "Will upload when internet returns. (%d pending)",
                pending,
            )

    def stop(self):
        """Gracefully stop the flush thread (call on SIGTERM / shutdown)."""
        log.info("[Firebase] Stopping — flushing any remaining buffered readings...")
        self._stop_event.set()
        # One final flush attempt before shutdown
        if has_internet():
            self._flush_pending()
        remaining = buffer.pending_count()
        if remaining:
            log.warning("[Firebase] %d readings still in local buffer (will upload on next boot).", remaining)
        else:
            log.info("[Firebase] All readings synced. Clean shutdown.")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _init_firebase(self, key_path: str, max_wait_sec: int = 120):
        """
        Try to initialise the Firebase Admin SDK.
        Retries every 10s for up to max_wait_sec seconds in case the
        network isn't up yet (common when booting from a powerbank).
        """
        attempt = 0
        while True:
            try:
                if not firebase_admin._apps:
                    cred = credentials.Certificate(key_path)
                    firebase_admin.initialize_app(cred)
                self.db = firestore.client()
                log.info("[Firebase] Connected to Firestore successfully.")
                return
            except Exception as e:
                attempt += 1
                waited = attempt * 10
                if waited >= max_wait_sec:
                    log.error(
                        "[Firebase] Could not connect after %ds. "
                        "Running in offline-only mode. Error: %s",
                        max_wait_sec, e,
                    )
                    return
                log.warning(
                    "[Firebase] Init failed (attempt %d). Retrying in 10s... (%s)",
                    attempt, e,
                )
                time.sleep(10)

    def _flush_loop(self):
        """Background thread: flush pending buffered readings, with exponential backoff on failures."""
        backoff = FLUSH_INTERVAL_SEC
        MAX_BACKOFF_SEC = 300  # cap at 5 minutes between retries
        while not self._stop_event.is_set():
            time.sleep(backoff)
            if buffer.pending_count() > 0 and has_internet():
                log.info("[Firebase] Flush timer — uploading buffered readings...")
                success = self._flush_pending()
                # P6: reset on success, double on failure (exponential backoff)
                backoff = FLUSH_INTERVAL_SEC if success else min(backoff * 2, MAX_BACKOFF_SEC)
                if not success:
                    log.warning("[Firebase] Flush failed. Next retry in %ds.", backoff)
            else:
                backoff = FLUSH_INTERVAL_SEC  # reset backoff when idle

    def _flush_pending(self) -> bool:
        """
        Upload all pending buffered readings to Firestore in batches.
        Marks each batch as synced after a successful write.
        Returns True if all pending records were uploaded, False on any error.
        """
        if not self.db:
            log.warning("[Firebase] Firestore not initialised — skipping flush.")
            return False

        pending = buffer.get_pending(limit=FLUSH_BATCH_SIZE)
        if not pending:
            return True

        synced_ids = []
        had_error = False
        for row in pending:
            try:
                self.db.collection("readings").add({
                    "deviceId":  row["device_id"],
                    "temp":      row["temp"],
                    "bpm":       row["bpm"],
                    "spo2":      row["spo2"],
                    "lat":       row["lat"],
                    "lon":       row["lon"],
                    "speedKmh":  row.get("speed_kmh"),
                    "heading":   row.get("heading"),
                    "timestamp": SERVER_TIMESTAMP,
                    # Also store original offline timestamp for reference
                    "recordedAt": row["recorded_at"],
                })
                synced_ids.append(row["id"])
            except Exception as e:
                log.error("[Firebase] Failed to upload reading id=%s: %s", row["id"], e)
                had_error = True
                break  # Stop this batch — don't mark remaining as synced

        if synced_ids:
            buffer.mark_synced(synced_ids)
            log.info(
                "[Firebase] Flushed %d reading(s) to Firestore. "
                "Still pending: %d",
                len(synced_ids),
                buffer.pending_count(),
            )

        # Also clean up old already-synced records (P3)
        buffer.cleanup_synced(keep_days=7)

        return not had_error
