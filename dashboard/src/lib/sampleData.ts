/**
 * Sample / demo data for local development without a Firebase project.
 *
 * Generates realistic dog-health telemetry readings so you can explore the
 * full dashboard UI without any Firebase credentials.
 *
 * Demo mode is enabled automatically when NEXT_PUBLIC_FIREBASE_API_KEY is
 * not set (or is the placeholder "AIzaSy...").
 */

import { Timestamp } from "firebase/firestore";
import { Reading } from "@/types/reading";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Dog walking around campus — base GPS coords (IIT Jodhpur, New Campus, Karwar) */
const BASE_LAT = 26.4716;
const BASE_LON = 73.1151;

const DEVICE_ID = "tbtn-001";

/** How many historical readings to generate (1 reading per 15 s) */
const HISTORY_COUNT = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Simple seeded pseudo-random (Mulberry32) so data looks consistent */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

/**
 * Gaussian noise approximation via Box-Muller.
 * Returns a value with mean=0 and std≈1.
 */
function gaussNoise() {
  return (
    (rand() + rand() + rand() + rand() + rand() + rand() - 3) / 3
  );
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Returns `count` readings spaced 15 s apart, ending at `endTime` (ms).
 * Metrics follow smooth random-walk within normal dog ranges.
 */
export function generateReadings(
  count: number = HISTORY_COUNT,
  endTime: number = Date.now()
): Reading[] {
  const readings: Reading[] = [];

  // Initial healthy values
  let temp = 38.2;
  let bpm = 95;
  let spo2 = 97.5;
  let lat = BASE_LAT;
  let lon = BASE_LON;

  // Walk backwards in time
  for (let i = count - 1; i >= 0; i--) {
    const tsMs = endTime - i * 15_000;

    // Random-walk each metric
    temp = clamp(temp + gaussNoise() * 0.05, 37.0, 39.8);
    bpm = clamp(bpm + gaussNoise() * 2, 58, 180);
    spo2 = clamp(spo2 + gaussNoise() * 0.2, 91, 99.9);

    // GPS wanders in a small radius (~200 m)
    lat = lat + gaussNoise() * 0.0003;
    lon = lon + gaussNoise() * 0.0003;

    // Occasionally inject a null GPS fix (5 % of readings)
    const hasGps = rand() > 0.05;

    readings.push({
      id: `demo-${i}`,
      deviceId: DEVICE_ID,
      timestamp: Timestamp.fromMillis(tsMs),
      temp: parseFloat(temp.toFixed(2)),
      bpm: Math.round(bpm),
      spo2: parseFloat(spo2.toFixed(1)),
      lat: hasGps ? parseFloat(lat.toFixed(6)) : null,
      lon: hasGps ? parseFloat(lon.toFixed(6)) : null,
    });
  }

  return readings;
}

// ---------------------------------------------------------------------------
// Pre-generated cache (generated once, reused)
// ---------------------------------------------------------------------------

let _cachedReadings: Reading[] | null = null;

export function getSampleReadings(): Reading[] {
  if (!_cachedReadings) {
    _cachedReadings = generateReadings();
  }
  return _cachedReadings;
}

/** Returns the single latest reading (newest entry in the sample set). */
export function getLatestSampleReading(): Reading {
  const all = getSampleReadings();
  return all[all.length - 1];
}

/** Returns a reading ~5 min before the latest, for trend arrows. */
export function getTrend5minSampleReading(): Reading {
  const all = getSampleReadings();
  // 5 min = 20 readings at 15 s cadence
  return all[Math.max(0, all.length - 21)];
}

// ---------------------------------------------------------------------------
// Demo mode detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the app should use local sample data instead of
 * connecting to Firebase (i.e., env vars are missing or still placeholder).
 */
export function isDemoMode(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "";
  return (
    apiKey === "" ||
    apiKey === "AIzaSy..." ||
    apiKey.startsWith("AIzaSy...") ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
  );
}
