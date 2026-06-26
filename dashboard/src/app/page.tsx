"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useLiveReading } from "@/hooks/useLiveReading";
import {
  tempStatus, bpmStatus, spo2Status,
  calcTrend, formatDelta,
} from "@/lib/thresholds";
import VitalCard from "@/components/VitalCard";
import StatusBadge from "@/components/StatusBadge";
import DeviceSelector from "@/components/DeviceSelector";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorState from "@/components/ErrorState";
import NoDataState from "@/components/NoDataState";

// Leaflet must be loaded client-side only (no SSR)
const LiveMapInner = dynamic(() => import("@/components/LiveMap"), {
  ssr: false,
  loading: () => (
    <div style={mapPlaceholderStyle}>
      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading map…</span>
    </div>
  ),
});

const KNOWN_DEVICES = ["tbtn-001"];

export default function LiveDashboard() {
  const [deviceId, setDeviceId] = useState(KNOWN_DEVICES[0]);
  const { latest, trend5min, loading, error, secondsAgo } = useLiveReading(deviceId);

  const isStale = secondsAgo !== null && secondsAgo > 120;

  // Threshold analysis
  const tempT = tempStatus(latest?.temp ?? null);
  const bpmT  = bpmStatus(latest?.bpm ?? null);
  const spo2T = spo2Status(latest?.spo2 ?? null);

  // Trend directions
  const tempTrend = calcTrend(latest?.temp ?? null, trend5min?.temp ?? null);
  const bpmTrend  = calcTrend(latest?.bpm  ?? null, trend5min?.bpm  ?? null);
  const spo2Trend = calcTrend(latest?.spo2 ?? null, trend5min?.spo2 ?? null);

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Live Vitals</h1>
          <p style={styles.pageSubtitle}>Real-time health telemetry · updates every ~15 seconds</p>
        </div>
        <div style={styles.headerControls}>
          <StatusBadge secondsAgo={secondsAgo} loading={loading} />
          <DeviceSelector
            value={deviceId}
            onChange={setDeviceId}
            knownDevices={KNOWN_DEVICES}
          />
        </div>
      </div>

      {/* Loading */}
      {loading && <LoadingSpinner label="Connecting to Firestore…" />}

      {/* Error */}
      {!loading && error && (
        <ErrorState
          title="Failed to connect"
          message={error}
        />
      )}

      {/* No data */}
      {!loading && !error && !latest && (
        <NoDataState
          title="No readings found"
          message={`No data for device "${deviceId}". Make sure the Pi is running and has written at least one reading to Firestore.`}
        />
      )}

      {/* Offline / stale banner */}
      {isStale && latest && (
        <div style={styles.staleBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <strong>Device offline or out of range</strong> — last reading was {
            secondsAgo !== null ? formatTime(secondsAgo) : "unknown time"
          } ago. Displaying last known values.
        </div>
      )}

      {/* Vital cards */}
      {!loading && latest && (
        <>
          <div className="grid-3" style={{ marginBottom: "var(--space-6)" }}>
            <VitalCard
              title="Temperature"
              value={latest.temp}
              unit="°C"
              threshold={tempT}
              trend={tempTrend}
              trendLabel={formatDelta(latest.temp, trend5min?.temp ?? null, "°C")}
              icon={<ThermometerIcon />}
              decimals={1}
              stale={isStale}
            />
            <VitalCard
              title="Heart Rate"
              value={latest.bpm}
              unit="bpm"
              threshold={bpmT}
              trend={bpmTrend}
              trendLabel={formatDelta(latest.bpm, trend5min?.bpm ?? null, " bpm")}
              icon={<HeartIcon />}
              decimals={0}
              stale={isStale}
            />
            <VitalCard
              title="Blood Oxygen"
              value={latest.spo2}
              unit="SpO₂ %"
              threshold={spo2T}
              trend={spo2Trend}
              trendLabel={formatDelta(latest.spo2, trend5min?.spo2 ?? null, "%")}
              icon={<DropletIcon />}
              decimals={1}
              stale={isStale}
            />
          </div>

          {/* GPS map + reading meta */}
          <div className="grid-2">
            <div className="card">
              <div className="card-header">
                <span className="card-title">GPS Location</span>
                {latest.lat !== null && latest.lon !== null ? (
                  <CoordBadge lat={latest.lat} lon={latest.lon} />
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>No fix</span>
                )}
              </div>
              <LiveMapInner lat={latest.lat} lon={latest.lon} label={`Device: ${deviceId}`} />
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Reading Info</span>
              </div>
              <ReadingMeta latest={latest} deviceId={deviceId} secondsAgo={secondsAgo} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function CoordBadge({ lat, lon }: { lat: number; lon: number }) {
  return (
    <a
      href={`https://maps.google.com/?q=${lat},${lon}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontSize: "0.7rem",
        fontFamily: "var(--font-mono)",
        color: "var(--accent)",
        background: "var(--accent-dim)",
        padding: "2px 8px",
        borderRadius: "20px",
        textDecoration: "none",
        border: "1px solid var(--accent-glow)",
      }}
    >
      {lat.toFixed(5)}, {lon.toFixed(5)} ↗
    </a>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReadingMeta({ latest, deviceId, secondsAgo }: { latest: any; deviceId: string; secondsAgo: number | null }) {
  const ts = latest.timestamp?.toDate?.() ?? null;
  const rows: Array<{ label: string; value: string }> = [
    { label: "Device ID",    value: deviceId },
    { label: "Document ID",  value: latest.id },
    { label: "Timestamp",    value: ts ? ts.toLocaleString() : "—" },
    { label: "Age",          value: secondsAgo !== null ? formatTime(secondsAgo) : "—" },
    { label: "GPS",          value: latest.lat !== null ? `${latest.lat.toFixed(4)}, ${latest.lon?.toFixed(4)}` : "No fix" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "var(--space-3)" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{r.label}</span>
          <span style={{ fontSize: "0.8rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", maxWidth: "60%", textAlign: "right", wordBreak: "break-all" }}>{r.value}</span>
        </div>
      ))}

      <div style={{ marginTop: "var(--space-4)", padding: "var(--space-3)", background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
          Data streamed from a <strong style={{ color: "var(--text-secondary)" }}>Raspberry Pi 5</strong> wearable device via Firebase Firestore. Updates automatically — no refresh needed.
        </p>
      </div>
    </div>
  );
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

/* ---- Icons ---- */
function ThermometerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  );
}
function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
function DropletIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

/* ---- Styles ---- */
const styles: Record<string, React.CSSProperties> = {
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "var(--space-4)",
    marginBottom: "var(--space-8)",
  },
  pageTitle: {
    fontSize: "clamp(1.5rem, 4vw, 2rem)",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.03em",
    lineHeight: 1.2,
  },
  pageSubtitle: {
    fontSize: "0.875rem",
    color: "var(--text-muted)",
    marginTop: "var(--space-1)",
  },
  headerControls: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-4)",
    flexWrap: "wrap",
  },
  staleBanner: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    padding: "var(--space-4) var(--space-5)",
    background: "rgba(245, 158, 11, 0.08)",
    border: "1px solid rgba(245, 158, 11, 0.25)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-warning)",
    fontSize: "0.875rem",
    marginBottom: "var(--space-6)",
    lineHeight: 1.5,
  },
};

const mapPlaceholderStyle: React.CSSProperties = {
  height: 260,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-elevated)",
  borderRadius: "var(--radius-md)",
};
