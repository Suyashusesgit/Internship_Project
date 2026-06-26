"use client";

import React from "react";

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div style={styles.wrapper} role="alert">
      <div style={styles.iconWrap}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-critical)" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 style={styles.title}>{title}</h3>
      <p style={styles.message}>{message}</p>
      {onRetry && (
        <button onClick={onRetry} style={styles.retryBtn}>
          Try again
        </button>
      )}
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
    background: "rgba(239, 68, 68, 0.05)",
    border: "1px solid rgba(239, 68, 68, 0.15)",
    borderRadius: "var(--radius-lg)",
  },
  iconWrap: {
    padding: "var(--space-3)",
    background: "rgba(239, 68, 68, 0.1)",
    borderRadius: "50%",
  },
  title: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--color-critical)",
  },
  message: {
    fontSize: "0.875rem",
    color: "var(--text-secondary)",
    maxWidth: 360,
  },
  retryBtn: {
    marginTop: "var(--space-2)",
    padding: "var(--space-2) var(--space-5)",
    background: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "var(--radius-md)",
    color: "var(--color-critical)",
    fontSize: "0.875rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition-fast)",
    fontFamily: "var(--font-sans)",
  },
};
