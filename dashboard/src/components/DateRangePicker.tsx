"use client";

import React from "react";
import { RangeDays } from "@/hooks/useHistoryReadings";

interface DateRangePickerProps {
  value: RangeDays;
  onChange: (days: RangeDays) => void;
}

const OPTIONS: { label: string; value: RangeDays }[] = [
  { label: "24 hours", value: 1 },
  { label: "3 days",   value: 3 },
  { label: "7 days",   value: 7 },
];

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div style={styles.wrapper} role="group" aria-label="Date range selector">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            ...styles.btn,
            ...(value === opt.value ? styles.btnActive : {}),
          }}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-md)",
    padding: "3px",
    gap: "3px",
  },
  btn: {
    padding: "var(--space-2) var(--space-4)",
    borderRadius: "calc(var(--radius-md) - 2px)",
    border: "none",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "0.8rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all var(--transition-fast)",
    fontFamily: "var(--font-sans)",
    whiteSpace: "nowrap",
  },
  btnActive: {
    background: "var(--accent)",
    color: "#fff",
    fontWeight: 600,
    boxShadow: "0 2px 8px rgba(20, 184, 166, 0.35)",
  },
};
