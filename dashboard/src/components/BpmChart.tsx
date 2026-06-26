"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

interface DataPoint {
  time: number;
  bpm: number | null;
}

interface BpmChartProps {
  data: DataPoint[];
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div style={tooltipStyle}>
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>
        {new Date(label).toLocaleString()}
      </div>
      <div style={{ fontSize: "1rem", fontWeight: 700, color: "#ec4899", fontFamily: "var(--font-mono)" }}>
        {val !== null ? `${Number(val).toFixed(0)} bpm` : "—"}
      </div>
    </div>
  );
}

export default function BpmChart({ data }: BpmChartProps) {
  if (data.length === 0) {
    return <ChartEmpty label="No BPM data" />;
  }

  const span = data[data.length - 1].time - data[0].time;
  const tickFormatter = span > 86400000 ? formatDate : formatTime;

  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["auto", "auto"]}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 10 }}
            tickCount={6}
            minTickGap={40}
          />
          <YAxis domain={[0, "auto"]} tick={{ fontSize: 10 }} width={40} />
          <Tooltip content={<CustomTooltip />} />
          {/* Normal band shading */}
          <ReferenceArea y1={60} y2={160} fill="rgba(34, 197, 94, 0.04)" />
          <ReferenceLine y={60}  stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine y={160} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Line
            type="monotone"
            dataKey="bpm"
            stroke="#ec4899"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#ec4899" }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartEmpty({ label }: { label: string }) {
  return (
    <div
      style={{
        height: 220,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: "0.875rem",
        background: "var(--bg-elevated)",
        borderRadius: "var(--radius-md)",
      }}
    >
      {label}
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-3) var(--space-4)",
  boxShadow: "var(--shadow-card)",
};
