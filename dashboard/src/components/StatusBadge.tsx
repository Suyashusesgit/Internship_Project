"use client";

import React from "react";

type Status = "online" | "stale" | "offline" | "loading";

interface StatusBadgeProps {
  secondsAgo: number | null;
  loading?: boolean;
}

function deriveStatus(secondsAgo: number | null, loading: boolean): Status {
  if (loading) return "loading";
  if (secondsAgo === null) return "offline";
  if (secondsAgo < 120) return "online"; // <2 min = online
  if (secondsAgo < 600) return "stale";  // <10 min = stale
  return "offline";
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; pulse: boolean }> = {
  online:  { label: "Live",    color: "var(--color-ok)",       bg: "var(--color-ok-dim)",       pulse: true  },
  stale:   { label: "Stale",   color: "var(--color-warning)",  bg: "var(--color-warning-dim)",  pulse: false },
  offline: { label: "Offline", color: "var(--color-critical)", bg: "var(--color-critical-dim)", pulse: false },
  loading: { label: "Loading", color: "var(--text-muted)",     bg: "var(--color-muted-dim)",    pulse: false },
};

export default function StatusBadge({ secondsAgo, loading = false }: StatusBadgeProps) {
  const status = deriveStatus(secondsAgo, loading);
  const cfg = STATUS_CONFIG[status];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
      <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
        {/* Pulsing ring for live status */}
        {cfg.pulse && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: cfg.color,
              animation: "pulse-ring 1.5s ease-out infinite",
            }}
          />
        )}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: cfg.color,
            display: "block",
            position: "relative",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: cfg.color,
          background: cfg.bg,
          padding: "2px 8px",
          borderRadius: "20px",
          border: `1px solid ${cfg.color}33`,
        }}
      >
        {cfg.label}
      </span>
      {secondsAgo !== null && !loading && (
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {formatTime(secondsAgo)}
        </span>
      )}
    </div>
  );
}

function formatTime(s: number): string {
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
