/**
 * Dog health thresholds used to colour-code vital signs.
 *
 * Sources: AVMA, VCA, and general canine physiology references.
 * Ranges are intentionally conservative — flag sooner rather than later.
 */

export type VitalStatus = "normal" | "warning" | "critical" | "unknown";

export interface ThresholdResult {
  status: VitalStatus;
  statusColor: string; // CSS custom-property name (var-ready)
  label: string;
}

// ---- Temperature (°C) --------------------------------------------------
// Dog normal: 37.5–39.2 °C
// Warning:    37.0–37.4 or 39.3–39.9
// Critical:   <37.0 or ≥40.0
export function tempStatus(value: number | null): ThresholdResult {
  if (value === null) return { status: "unknown", statusColor: "var(--color-muted)", label: "No data" };
  if (value < 37.0 || value >= 40.0) return { status: "critical", statusColor: "var(--color-critical)", label: "Critical" };
  if (value < 37.5 || value >= 39.3) return { status: "warning", statusColor: "var(--color-warning)", label: "Warning" };
  return { status: "normal", statusColor: "var(--color-ok)", label: "Normal" };
}

// ---- BPM ---------------------------------------------------------------
// Dog normal: 60–160 bpm (generic mid-size dog)
// Warning:    40–59 or 161–200
// Critical:   <40 or >200
export function bpmStatus(value: number | null): ThresholdResult {
  if (value === null) return { status: "unknown", statusColor: "var(--color-muted)", label: "No data" };
  if (value < 40 || value > 200) return { status: "critical", statusColor: "var(--color-critical)", label: "Critical" };
  if (value < 60 || value > 160) return { status: "warning", statusColor: "var(--color-warning)", label: "Warning" };
  return { status: "normal", statusColor: "var(--color-ok)", label: "Normal" };
}

// ---- SpO2 (%) ----------------------------------------------------------
// Dog normal: ≥95 %
// Warning:    90–94 %
// Critical:   <90 %
export function spo2Status(value: number | null): ThresholdResult {
  if (value === null) return { status: "unknown", statusColor: "var(--color-muted)", label: "No data" };
  if (value < 90) return { status: "critical", statusColor: "var(--color-critical)", label: "Critical" };
  if (value < 95) return { status: "warning", statusColor: "var(--color-warning)", label: "Warning" };
  return { status: "normal", statusColor: "var(--color-ok)", label: "Normal" };
}

// ---- Trend helpers -----------------------------------------------------
export type TrendDirection = "up" | "down" | "flat" | "unknown";

export function calcTrend(current: number | null, previous: number | null, epsilon = 0.1): TrendDirection {
  if (current === null || previous === null) return "unknown";
  const delta = current - previous;
  if (Math.abs(delta) < epsilon) return "flat";
  return delta > 0 ? "up" : "down";
}

export function formatDelta(current: number | null, previous: number | null, unit: string): string {
  if (current === null || previous === null) return "";
  const delta = current - previous;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}${unit}`;
}
