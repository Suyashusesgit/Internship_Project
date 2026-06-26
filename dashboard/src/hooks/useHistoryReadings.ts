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

export function useHistoryReadings(deviceId: string, rangeDays: RangeDays): HistoryState {
  const [state, setState] = useState<HistoryState>({
    readings: [],
    downsampled: { temp: [], bpm: [], spo2: [] },
    gpsTrail: [],
    loading: true,
    error: null,
    truncated: false,
  });

  useEffect(() => {
    if (!deviceId) return;

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

        // Build time-indexed arrays for each metric
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

        // Downsample each series independently with LTTB
        const dsTemp = lttbDownsample(tempPoints, CHART_POINTS, "temp");
        const dsBpm = lttbDownsample(bpmPoints, CHART_POINTS, "bpm");
        const dsSpo2 = lttbDownsample(spo2Points, CHART_POINTS, "spo2");

        // GPS trail — keep all points with valid lat/lon (these are sparse)
        const gpsTrail = readings
          .filter((r) => r.lat !== null && r.lon !== null)
          .map((r) => ({ lat: r.lat!, lon: r.lon!, time: r.timestamp.toDate().getTime() }));

        setState({
          readings,
          downsampled: { temp: dsTemp, bpm: dsBpm, spo2: dsSpo2 },
          gpsTrail,
          loading: false,
          error: null,
          truncated,
        });
      })
      .catch((err) => {
        console.error("useHistoryReadings error:", err);
        setState((prev) => ({ ...prev, loading: false, error: err.message }));
      });
  }, [deviceId, rangeDays]);

  return state;
}
