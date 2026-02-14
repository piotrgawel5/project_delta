import type { SleepRecord, UserBaseline } from '@shared';
import { DEFAULT_SLEEP_GOAL_MINUTES } from '@constants';

function parseMinutesFromMidnight(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  let minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < 12 * 60) minutes += 24 * 60;
  return minutes;
}

function insertSorted(values: number[], value: number): void {
  let index = values.findIndex((item) => item > value);
  if (index === -1) index = values.length;
  values.splice(index, 0, value);
}

function percentileFromSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const rank = (sorted.length - 1) * p;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const ratio = rank - low;
  return sorted[low] + (sorted[high] - sorted[low]) * ratio;
}

function medianFromSorted(sorted: number[]): number {
  return percentileFromSorted(sorted, 0.5);
}

function safeAverage(sum: number, count: number, fallback = 0): number {
  return count > 0 ? sum / count : fallback;
}

function computeDseMinutes(record: SleepRecord): number {
  const tst = record.durationMinutes ?? 0;
  if (record.startTime && record.endTime) {
    const start = new Date(record.startTime).getTime();
    const end = new Date(record.endTime).getTime();
    const diff = (end - start) / 60000;
    if (diff > 0) return diff;
  }
  return tst + (record.awakeSleepMinutes ?? 0);
}

export function computeBaseline(history: SleepRecord[]): UserBaseline {
  const durationsSorted: number[] = [];
  const bedtimesSorted: number[] = [];
  const wakeTimesSorted: number[] = [];

  let nights = 0;
  let durationSum = 0;
  let deepPctSum = 0;
  let remPctSum = 0;
  let efficiencySum = 0;
  let wasoSum = 0;
  let deepCount = 0;
  let remCount = 0;
  let efficiencyCount = 0;
  let wasoCount = 0;

  let bedtimeMean = 0;
  let bedtimeM2 = 0;
  let bedtimeN = 0;

  for (const record of history) {
    const tst = record.durationMinutes ?? 0;
    if (tst <= 0) continue;

    nights += 1;
    durationSum += tst;
    insertSorted(durationsSorted, tst);

    const deep = record.deepSleepMinutes ?? 0;
    if (deep > 0) {
      deepPctSum += (deep / tst) * 100;
      deepCount += 1;
    }

    const rem = record.remSleepMinutes ?? 0;
    if (rem > 0) {
      remPctSum += (rem / tst) * 100;
      remCount += 1;
    }

    const dse = computeDseMinutes(record);
    if (dse > 0) {
      efficiencySum += tst / dse;
      efficiencyCount += 1;
    }

    if (record.awakeSleepMinutes !== null && record.awakeSleepMinutes !== undefined) {
      wasoSum += record.awakeSleepMinutes;
      wasoCount += 1;
    }

    const bedtime = parseMinutesFromMidnight(record.startTime);
    if (bedtime !== null) {
      insertSorted(bedtimesSorted, bedtime);
      bedtimeN += 1;
      const delta = bedtime - bedtimeMean;
      bedtimeMean += delta / bedtimeN;
      bedtimeM2 += delta * (bedtime - bedtimeMean);
    }

    const wake = parseMinutesFromMidnight(record.endTime);
    if (wake !== null) {
      insertSorted(wakeTimesSorted, wake);
    }
  }

  return {
    avgDurationMin: safeAverage(durationSum, nights, DEFAULT_SLEEP_GOAL_MINUTES),
    avgDeepPct: safeAverage(deepPctSum, deepCount, 0),
    avgRemPct: safeAverage(remPctSum, remCount, 0),
    avgEfficiency: safeAverage(efficiencySum, efficiencyCount, 0),
    avgWasoMin: safeAverage(wasoSum, wasoCount, 0),
    medianBedtimeMinutesFromMidnight: medianFromSorted(bedtimesSorted),
    medianWakeMinutesFromMidnight: medianFromSorted(wakeTimesSorted),
    bedtimeVarianceMinutes: bedtimeN > 1 ? Math.sqrt(bedtimeM2 / bedtimeN) : 0,
    p25DurationMin: percentileFromSorted(durationsSorted, 0.25),
    p75DurationMin: percentileFromSorted(durationsSorted, 0.75),
    nightsAnalysed: nights,
  };
}
