"use client";

import React from "react";
import { ThresholdResult, TrendDirection, VitalStatus } from "@/lib/thresholds";

interface VitalCardProps {
  title: string;
  value: number | null;
  unit: string;
  threshold: ThresholdResult;
  trend: TrendDirection;
  trendLabel?: string;
  icon: React.ReactNode;
  decimals?: number;
  stale?: boolean;
}

const GLOW_MAP: Record<VitalStatus, string> = {
  normal:  "var(--shadow-glow-ok)",
  warning: "var(--shadow-glow-warn)",
  critical:"var(--shadow-glow-crit)",
  unknown: "none",
};

export default function VitalCard({
  title,
  value,
  unit,
  threshold,
  trend,
  trendLabel,
  icon,
  decimals = 1,
  stale = false,
}: VitalCardProps) {
  const displayValue = value !== null ? value.toFixed(decimals) : "—";
  const glow = stale ? "none" : GLOW_MAP[threshold.status];

  return (
    <div
      className="card animate-fade-in"
      style={{
        borderColor: stale
          ? "var(--border-subtle)"
          : `${threshold.statusColor}55`,
        boxShadow: `var(--shadow-card), ${glow}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: stale
            ? "var(--border-subtle)"
            : threshold.statusColor,
          transition: "background var(--transition-slow)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
        }}
      />

      <div style={{ padding: "var(--space-1) 0 0" }}>
        {/* Header */}
        <div className="card-header">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <div
              style={{
                padding: "var(--space-2)",
                background: stale ? "var(--bg-elevated)" : `${threshold.statusColor}18`,
                borderRadius: "var(--radius-sm)",
                color: stale ? "var(--text-muted)" : threshold.statusColor,
                display: "flex",
                alignItems: "center",
                transition: "all var(--transition-normal)",
              }}
            >
              {icon}
            </div>
            <span className="card-title">{title}</span>
          </div>
          <StatusPill threshold={threshold} stale={stale} />
        </div>

        {/* Value */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <span
            className="text-mono"
            style={{
              fontSize: "clamp(2rem, 5vw, 3rem)",
              fontWeight: 700,
              lineHeight: 1,
              color: stale ? "var(--text-muted)" : threshold.statusColor,
              transition: "color var(--transition-normal)",
              letterSpacing: "-0.02em",
            }}
          >
            {displayValue}
          </span>
          <span
            style={{
              fontSize: "1rem",
              fontWeight: 500,
              color: "var(--text-secondary)",
              marginBottom: "2px",
            }}
          >
            {unit}
          </span>
        </div>

        {/* Trend */}
        {!stale && value !== null && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <TrendArrow direction={trend} color={threshold.statusColor} />
            {trendLabel && (
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {trendLabel} vs 5 min ago
              </span>
            )}
          </div>
        )}
        {stale && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            ⚠ Stale reading — device may be offline
          </span>
        )}
      </div>
    </div>
  );
}

function StatusPill({ threshold, stale }: { threshold: ThresholdResult; stale: boolean }) {
  const color = stale ? "var(--text-muted)" : threshold.statusColor;
  const bg = stale ? "var(--color-muted-dim)" : `${threshold.statusColor}18`;
  const label = stale ? "Stale" : threshold.label;

  return (
    <span
      style={{
        fontSize: "0.65rem",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color,
        background: bg,
        padding: "3px 10px",
        borderRadius: "20px",
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </span>
  );
}

function TrendArrow({ direction, color }: { direction: TrendDirection; color: string }) {
  if (direction === "unknown" || direction === "flat") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    );
  }
  const isUp = direction === "up";
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      style={{ transform: isUp ? "none" : "rotate(180deg)" }}
    >
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}
