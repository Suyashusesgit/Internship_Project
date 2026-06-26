"use client";

import React from "react";

interface DeviceSelectorProps {
  value: string;
  onChange: (deviceId: string) => void;
  knownDevices?: string[];
}

const DEFAULT_DEVICES = ["tbtn-001"];

export default function DeviceSelector({
  value,
  onChange,
  knownDevices = DEFAULT_DEVICES,
}: DeviceSelectorProps) {
  return (
    <div style={styles.wrapper}>
      <label htmlFor="device-select" style={styles.label}>
        Device
      </label>
      <div style={styles.selectWrap}>
        <select
          id="device-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={styles.select}
        >
          {knownDevices.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
        <svg
          style={styles.chevron}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-secondary)"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
  },
  label: {
    fontSize: "0.75rem",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
  },
  selectWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  select: {
    appearance: "none",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-default)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-primary)",
    fontSize: "0.875rem",
    fontWeight: 500,
    fontFamily: "var(--font-mono)",
    padding: "var(--space-2) var(--space-8) var(--space-2) var(--space-3)",
    cursor: "pointer",
    outline: "none",
    transition: "border-color var(--transition-fast)",
  },
  chevron: {
    position: "absolute",
    right: "var(--space-3)",
    pointerEvents: "none",
  },
};
