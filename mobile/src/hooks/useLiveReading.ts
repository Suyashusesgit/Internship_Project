import { useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { Reading } from "../types/reading";

export interface LiveReadingState {
  latest: Reading | null;
  trend5min: Reading | null; // reading ~5 min ago for trend arrows
  loading: boolean;
  error: string | null;
  secondsAgo: number | null; // seconds since last reading arrived
}

function docToReading(doc: DocumentData & { id: string }): Reading {
  const d = doc.data();
  return {
    id: doc.id,
    deviceId: d.deviceId ?? "",
    timestamp: d.timestamp,
    temp: d.temp ?? null,
    bpm: d.bpm ?? null,
    spo2: d.spo2 ?? null,
    lat: d.lat ?? null,
    lon: d.lon ?? null,
  };
}

export function useLiveReading(deviceId: string): LiveReadingState {
  const [state, setState] = useState<LiveReadingState>({
    latest: null,
    trend5min: null,
    loading: true,
    error: null,
    secondsAgo: null,
  });

  const latestRef = useRef<Reading | null>(null);

  useEffect(() => {
    latestRef.current = state.latest;
  }, [state.latest]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!latestRef.current?.timestamp) return;
      const ms = Date.now() - latestRef.current.timestamp.toDate().getTime();
      setState((prev) => ({ ...prev, secondsAgo: Math.floor(ms / 1000) }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!deviceId) return;

    let isCancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const q = query(
      collection(db, "readings"),
      where("deviceId", "==", deviceId),
      orderBy("timestamp", "desc"),
      limit(25)
    );

    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        if (isCancelled) return;
        const docs = snap.docs.map(
          (d) => docToReading(d as unknown as DocumentData & { id: string })
        );

        if (docs.length === 0) {
          setState({ latest: null, trend5min: null, loading: false, error: null, secondsAgo: null });
          return;
        }

        const latest = docs[0];
        const latestMs = latest.timestamp.toDate().getTime();
        const fiveMinMs = 5 * 60 * 1000;

        let trend5min: Reading | null = null;
        let bestDelta = Infinity;
        for (const doc of docs) {
          const delta = Math.abs(latestMs - doc.timestamp.toDate().getTime() - fiveMinMs);
          if (delta < bestDelta) {
            bestDelta = delta;
            trend5min = doc;
          }
        }
        if (trend5min?.id === latest.id) trend5min = docs.length > 1 ? docs[docs.length - 1] : null;

        const secondsAgo = Math.floor((Date.now() - latestMs) / 1000);
        setState({ latest, trend5min, loading: false, error: null, secondsAgo });
      },
      (err) => {
        if (isCancelled) return;
        console.error("useLiveReading error:", err);
        setState((prev) => ({ ...prev, loading: false, error: err.message }));
      }
    );

    return () => {
      isCancelled = true;
      unsub();
    };
  }, [deviceId]);

  return state;
}
