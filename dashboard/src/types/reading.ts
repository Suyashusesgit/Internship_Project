import { Timestamp } from "firebase/firestore";

export interface Reading {
  id: string; // Firestore document ID
  deviceId: string;
  timestamp: Timestamp;
  temp: number | null;
  bpm: number | null;
  spo2: number | null;
  lat: number | null;
  lon: number | null;
}

export type DeviceId = string;
