"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useHistoryReadings, RangeDays } from "@/hooks/useHistoryReadings";
import DateRangePicker from "@/components/DateRangePicker";
import DeviceSelector from "@/components/DeviceSelector";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorState from "@/components/ErrorState";
import NoDataState from "@/components/NoDataState";
import TempChart from "@/components/TempChart";
import BpmChart from "@/components/BpmChart";
import Spo2Chart from "@/components/Spo2Chart";

// Leaflet must be client-side only
const TrailMapInner = dynamic(() => import("@/components/TrailMap"), {
  ssr: false,
  loading: () => (
    <div style={mapPlaceholderStyle}>
      <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Loading map…</span>
    </div>
  ),
});

const KNOWN_DEVICES = ["tbtn-001"];

export default function HistoryPage() {
  const [deviceId, setDeviceId] = useState(KNOWN_DEVICES[0]);
  const [range, setRange] = useState<RangeDays>(7);

  const { downsampled, gpsTrail, loading, error, truncated, readings } =
    useHistoryReadings(deviceId, range);

  const noData = !loading && !error && readings.length === 0;

  // P9: CSV export
  function exportCSV() {
    if (!readings.length) return;
    const header = "timestamp,temp_c,bpm,spo2_pct,lat,lon";
    const rows = readings.map((r) => {
      const ts = r.timestamp?.toDate?.()?.toISOString() ?? "";
      return [ts, r.temp ?? "", r.bpm ?? "", r.spo2 ?? "", r.lat ?? "", r.lon ?? ""].join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tbtn_${deviceId}_${range}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="animate-fade-in">
      {/* Page header */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>History</h1>
          <p style={styles.pageSubtitle}>
            {readings.length > 0
              ? `${readings.length.toLocaleString()} readings loaded${truncated ? " (capped at 2,000)" : ""}`
              : "Historical telemetry charts"}
          </p>
        </div>
        <div style={styles.headerControls}>
          <DateRangePicker value={range} onChange={setRange} />
          <DeviceSelector
            value={deviceId}
            onChange={setDeviceId}
            knownDevices={KNOWN_DEVICES}
          />
          {/* P9: CSV Export button */}
          {readings.length > 0 && (
            <button
              onClick={exportCSV}
              style={styles.exportBtn}
              title="Export all readings as CSV"
            >
              ⬇ Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Truncation warning */}
      {truncated && (
        <div style={styles.truncateBanner}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Query capped at 2,000 documents. Charts show a downsampled representation of the data. Choose a shorter range for full fidelity.
        </div>
      )}

      {/* Loading */}
      {loading && <LoadingSpinner label="Loading history from Firestore…" />}

      {/* Error */}
      {!loading && error && (
        <ErrorState title="Failed to load history" message={error} />
      )}

      {/* No data */}
      {noData && (
        <NoDataState
          title="No history found"
          message={`No readings for "${deviceId}" in the last ${range} day${range !== 1 ? "s" : ""}. Try a different range or device.`}
        />
      )}

      {/* Charts */}
      {!loading && !error && readings.length > 0 && (
        <>
          {/* Temperature */}
          <section style={{ marginBottom: "var(--space-6)" }}>
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={styles.chartDot} data-color="#f97316" />
                  <span className="card-title">Temperature</span>
                </div>
                <ChartMeta unit="°C" count={downsampled.temp.length} />
              </div>
              <ChartLegend items={[
                { color: "#22c55e", label: "Normal range (37.5 – 39.2 °C)", dashed: true },
                { color: "#f97316", label: "Measured" },
              ]} />
              <TempChart data={downsampled.temp} />
            </div>
          </section>

          {/* BPM */}
          <section style={{ marginBottom: "var(--space-6)" }}>
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ ...styles.chartDot, background: "#ec4899" }} />
                  <span className="card-title">Heart Rate</span>
                </div>
                <ChartMeta unit="bpm" count={downsampled.bpm.length} />
              </div>
              <ChartLegend items={[
                { color: "#22c55e", label: "Normal range (60 – 160 bpm)", dashed: true },
                { color: "#ec4899", label: "Measured" },
              ]} />
              <BpmChart data={downsampled.bpm} />
            </div>
          </section>

          {/* SpO2 */}
          <section style={{ marginBottom: "var(--space-8)" }}>
            <div className="card">
              <div className="card-header">
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ ...styles.chartDot, background: "#818cf8" }} />
                  <span className="card-title">Blood Oxygen (SpO₂)</span>
                </div>
                <ChartMeta unit="%" count={downsampled.spo2.length} />
              </div>
              <ChartLegend items={[
                { color: "#22c55e", label: "≥ 95% (normal)", dashed: true },
                { color: "#f59e0b", label: "90% (warning threshold)", dashed: true },
                { color: "#818cf8", label: "Measured" },
              ]} />
              <Spo2Chart data={downsampled.spo2} />
            </div>
          </section>

          {/* GPS Trail */}
          <section style={{ marginBottom: "var(--space-6)" }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">GPS Trail</span>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  {gpsTrail.length} points
                </span>
              </div>
              <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
                <TrailLegendItem color="#6366f1" label="Start" />
                <TrailLegendItem color="#14b8a6" label="End / Most Recent" />
                <TrailLegendItem color="#14b8a6" label="Trail" line />
              </div>
              <TrailMapInner trail={gpsTrail} />
            </div>
          </section>

          {/* Stats summary */}
          <section>
            <div className="card">
              <div className="card-header">
                <span className="card-title">Range Summary</span>
              </div>
              <SummaryStats readings={readings} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ---- Sub-components ---- */

function ChartMeta({ unit, count }: { unit: string; count: number }) {
  return (
    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
      {count} pts · {unit}
    </span>
  );
}

function ChartLegend({ items }: { items: Array<{ color: string; label: string; dashed?: boolean }> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-3)" }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div
            style={{
              width: 20,
              height: 2,
              background: item.color,
              borderRadius: 1,
              opacity: item.dashed ? 0.7 : 1,
              backgroundImage: item.dashed
                ? `repeating-linear-gradient(90deg, ${item.color} 0, ${item.color} 4px, transparent 4px, transparent 8px)`
                : undefined,
            }}
          />
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function TrailLegendItem({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      {line ? (
        <div style={{ width: 20, height: 2, background: color, borderRadius: 1 }} />
      ) : (
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
      )}
      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{label}</span>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SummaryStats({ readings }: { readings: any[] }) {
  const temps   = readings.map((r) => r.temp).filter((v) => v !== null) as number[];
  const bpms    = readings.map((r) => r.bpm).filter((v)  => v !== null) as number[];
  const spo2s   = readings.map((r) => r.spo2).filter((v) => v !== null) as number[];

  const s = (arr: number[]) => ({
    min: arr.length ? Math.min(...arr) : null,
    max: arr.length ? Math.max(...arr) : null,
    avg: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null,
  });

  const tS = s(temps), bS = s(bpms), oS = s(spo2s);

  const cols: Array<{ label: string; min: number | null; max: number | null; avg: number | null; unit: string; dp: number }> = [
    { label: "Temperature", ...tS, unit: "°C", dp: 1 },
    { label: "Heart Rate",  ...bS, unit: "bpm", dp: 0 },
    { label: "SpO₂",        ...oS, unit: "%",   dp: 1 },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-5)" }}>
      {cols.map((c) => (
        <div key={c.label} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>{c.label}</span>
          {[
            { label: "Min", val: c.min },
            { label: "Avg", val: c.avg },
            { label: "Max", val: c.max },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{row.label}</span>
              <span style={{ fontSize: "0.875rem", fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 500 }}>
                {row.val !== null ? `${row.val.toFixed(c.dp)} ${c.unit}` : "—"}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
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
    gap: "var(--space-3)",
    flexWrap: "wrap",
  },
  exportBtn: {
    background: "var(--accent-dim)",
    color: "var(--accent)",
    border: "1px solid var(--accent-glow)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-2) var(--space-4)",
    fontSize: "0.8rem",
    fontWeight: 600,
    fontFamily: "var(--font-sans)",
    cursor: "pointer",
    transition: "all var(--transition-fast)",
    whiteSpace: "nowrap" as const,
  },
  truncateBanner: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    padding: "var(--space-3) var(--space-5)",
    background: "rgba(99, 102, 241, 0.08)",
    border: "1px solid rgba(99, 102, 241, 0.25)",
    borderRadius: "var(--radius-md)",
    color: "#818cf8",
    fontSize: "0.8rem",
    marginBottom: "var(--space-5)",
  },
  chartDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#f97316",
  },
};

const mapPlaceholderStyle: React.CSSProperties = {
  height: 340,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-elevated)",
  borderRadius: "var(--radius-md)",
};
