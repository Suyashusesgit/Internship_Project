import firebase_admin
from firebase_admin import credentials, firestore

class FirebaseClient:
    def __init__(self, key_path="serviceAccountKey.json"):
        self.db = None
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate(key_path)
                firebase_admin.initialize_app(cred)
            self.db = firestore.client()
            print("[Firebase] Initialized successfully.")
        except Exception as e:
            print(f"[Firebase] Initialization failed (is {key_path} missing?): {e}")

    def publish_reading(self, reading_data):
        if not self.db:
            return
        try:
            reading_data["timestamp"] = firestore.SERVER_TIMESTAMP
            self.db.collection("readings").add(reading_data)
            print(f"[Firebase] Streamed data to cloud: BPM={reading_data.get('bpm')}")
        except Exception as e:
            print(f"[Firebase] Failed to publish: {e}")
