/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling algorithm.
 *
 * Reduces a dense time-series to `targetCount` points while preserving
 * the visual shape of the curve. This keeps Recharts fast for 7-day views
 * without a serverless proxy or Cloud Functions.
 *
 * Reference: Sveinn Steinarsson, "Downsampling Time Series for Visual Representation" (2013)
 */
export interface DataPoint {
  time: number; // Unix ms timestamp
  [key: string]: number | null;
}

export function lttbDownsample<T extends DataPoint>(
  data: T[],
  targetCount: number,
  yKey: keyof T
): T[] {
  const len = data.length;
  if (len <= targetCount || targetCount <= 2) return data;

  const sampled: T[] = [];
  const every = (len - 2) / (targetCount - 2);
  let a = 0; // previously selected index
  sampled.push(data[0]);

  for (let i = 0; i < targetCount - 2; i++) {
    // Calculate bucket range for the next bucket (lookahead average)
    const avgRangeStart = Math.floor((i + 1) * every) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * every) + 1, len);
    let avgX = 0;
    let avgY = 0;
    let avgCount = 0;
    for (let j = avgRangeStart; j < avgRangeEnd; j++) {
      const yVal = data[j][yKey] as number | null;
      if (yVal !== null) {
        avgX += data[j].time;
        avgY += yVal;
        avgCount++;
      }
    }
    if (avgCount > 0) {
      avgX /= avgCount;
      avgY /= avgCount;
    }

    // Current bucket range
    const rangeStart = Math.floor(i * every) + 1;
    const rangeEnd = Math.floor((i + 1) * every) + 1;
    const pointAX = data[a].time;
    const pointAY = (data[a][yKey] as number | null) ?? 0;

    let maxArea = -1;
    let maxIndex = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j++) {
      const yVal = data[j][yKey] as number | null;
      if (yVal === null) continue;
      const area = Math.abs(
        (pointAX - avgX) * (yVal - pointAY) -
        (pointAX - data[j].time) * (avgY - pointAY)
      ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        maxIndex = j;
      }
    }

    sampled.push(data[maxIndex]);
    a = maxIndex;
  }

  sampled.push(data[len - 1]);
  return sampled;
}

/**
 * Simple nth-point downsampling — used as a fast fallback when data is
 * sparse (e.g. only a few hundred points). Takes every Nth point.
 */
export function nthPointDownsample<T>(data: T[], targetCount: number): T[] {
  if (data.length <= targetCount) return data;
  const step = Math.ceil(data.length / targetCount);
  return data.filter((_, i) => i % step === 0);
}
