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

    if (maxIndex < data.length) {
      sampled.push(data[maxIndex]);
      a = maxIndex;
    }
  }

  sampled.push(data[len - 1]);
  return sampled;
}
