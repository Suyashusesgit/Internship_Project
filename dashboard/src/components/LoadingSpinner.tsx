"use client";

import React from "react";

export default function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={styles.wrapper} role="status" aria-label={label}>
      <div style={styles.ring}>
        <div style={styles.ringInner} />
      </div>
      <span style={styles.label}>{label}</span>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .tbtn-spinner-ring {
          animation: spin 0.9s linear infinite;
        }
      `}</style>
    </div>
  );
}

export function CardSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="skeleton card"
      style={{ height, borderRadius: "var(--radius-lg)" }}
      aria-hidden="true"
    />
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-3)",
    padding: "var(--space-12)",
    color: "var(--text-muted)",
  },
  ring: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    border: "3px solid var(--border-default)",
    borderTopColor: "var(--accent)",
    animation: "spin 0.9s linear infinite",
  },
  ringInner: {},
  label: {
    fontSize: "0.875rem",
    color: "var(--text-muted)",
  },
};
