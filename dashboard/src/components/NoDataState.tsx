"use client";

import React from "react";

interface NoDataStateProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
}

export default function NoDataState({
  title = "No data yet",
  message = "Waiting for the first reading from the device…",
}: NoDataStateProps) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.iconWrap}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
          <path d="M3 12h18M3 6h18M3 18h10" strokeLinecap="round" />
        </svg>
      </div>
      <h3 style={styles.title}>{title}</h3>
      <p style={styles.message}>{message}</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-3)",
    padding: "var(--space-12) var(--space-6)",
    textAlign: "center",
  },
  iconWrap: {
    padding: "var(--space-4)",
    background: "var(--bg-elevated)",
    borderRadius: "50%",
    border: "1px solid var(--border-subtle)",
  },
  title: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  message: {
    fontSize: "0.875rem",
    color: "var(--text-muted)",
    maxWidth: 320,
  },
};
