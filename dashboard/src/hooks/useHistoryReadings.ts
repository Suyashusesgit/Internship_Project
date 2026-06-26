"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Reading } from "@/types/reading";
import { lttbDownsample, DataPoint } from "@/lib/downsample";
import { isDemoMode, getSampleReadings } from "@/lib/sampleData";

export type RangeDays = 1 | 3 | 7;

export interface HistoryState {
  readings: Reading[];
  downsampled: {
    temp: Array<{ time: number; temp: number | null }>;
    bpm: Array<{ time: number; bpm: number | null }>;
    spo2: Array<{ time: number; spo2: number | null }>;
  };
  gpsTrail: Array<{ lat: number; lon: number; time: number }>;
  loading: boolean;
  error: string | null;
  truncated: boolean; // true if we hit the 2000-doc cap
  isDemo: boolean;
}

const MAX_DOCS = 2000;
const CHART_POINTS = 500; // target after downsampling

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

/** Filter sample readings to the requested time window */
function filterByRange(readings: Reading[], rangeDays: RangeDays): Reading[] {
  const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  return readings.filter((r) => r.timestamp.toMillis() >= cutoff);
}

function buildState(readings: Reading[], truncated: boolean, isDemo: boolean): HistoryState {
  const tempPoints: Array<DataPoint & { temp: number | null }> = readings.map((r) => ({
    time: r.timestamp.toDate().getTime(),
    temp: r.temp,
  }));
  const bpmPoints: Array<DataPoint & { bpm: number | null }> = readings.map((r) => ({
    time: r.timestamp.toDate().getTime(),
    bpm: r.bpm,
  }));
  const spo2Points: Array<DataPoint & { spo2: number | null }> = readings.map((r) => ({
    time: r.timestamp.toDate().getTime(),
    spo2: r.spo2,
  }));

  const dsTemp = lttbDownsample(tempPoints, CHART_POINTS, "temp");
  const dsBpm = lttbDownsample(bpmPoints, CHART_POINTS, "bpm");
  const dsSpo2 = lttbDownsample(spo2Points, CHART_POINTS, "spo2");

  const gpsTrail = readings
    .filter((r) => r.lat !== null && r.lon !== null)
    .map((r) => ({ lat: r.lat!, lon: r.lon!, time: r.timestamp.toDate().getTime() }));

  return {
    readings,
    downsampled: { temp: dsTemp, bpm: dsBpm, spo2: dsSpo2 },
    gpsTrail,
    loading: false,
    error: null,
    truncated,
    isDemo,
  };
}

export function useHistoryReadings(deviceId: string, rangeDays: RangeDays): HistoryState {
  const demo = isDemoMode();

  const [state, setState] = useState<HistoryState>({
    readings: [],
    downsampled: { temp: [], bpm: [], spo2: [] },
    gpsTrail: [],
    loading: true,
    error: null,
    truncated: false,
    isDemo: demo,
  });

  // ── Demo mode: slice the pre-generated sample set ───────────────────────
  useEffect(() => {
    if (!demo || !deviceId) return;

    setState((prev) => ({ ...prev, loading: true }));

    // Slight async delay so the loading spinner renders (feels realistic)
    const t = setTimeout(() => {
      const all = getSampleReadings();
      const filtered = filterByRange(all, rangeDays);
      const truncated = filtered.length >= MAX_DOCS;
      setState(buildState(filtered, truncated, true));
    }, 600);

    return () => clearTimeout(t);
  }, [demo, deviceId, rangeDays]);

  // ── Live mode: Firestore getDocs ────────────────────────────────────────
  useEffect(() => {
    if (demo || !deviceId) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - rangeDays);
    const startTimestamp = Timestamp.fromDate(startDate);

    const q = query(
      collection(db, "readings"),
      where("deviceId", "==", deviceId),
      where("timestamp", ">=", startTimestamp),
      orderBy("timestamp", "asc"),
      limit(MAX_DOCS)
    );

    getDocs(q)
      .then((snap) => {
        const truncated = snap.size >= MAX_DOCS;
        const readings = snap.docs.map((d) =>
          docToReading(d as unknown as DocumentData & { id: string })
        );
        setState(buildState(readings, truncated, false));
      })
      .catch((err) => {
        console.error("useHistoryReadings error:", err);
        setState((prev) => ({ ...prev, loading: false, error: err.message }));
      });
  }, [demo, deviceId, rangeDays]);

  return state;
}
