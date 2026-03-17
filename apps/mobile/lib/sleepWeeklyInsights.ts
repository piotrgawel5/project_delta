import { SLEEP_THEME } from '@constants';
import type { HeroGradientStops, WeekSeriesData } from '../types/sleep-ui';

type SleepRecordLike = {
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  sleep_score?: number | null;
  score_breakdown?: {
    score?: number | null;
  } | null;
};

const WEEK_LENGTH = 7;
const MONDAY_INDEX = 0;
const BEDTIME_NOON_MINUTES = 12 * 60;
const GRADE_BLEND_RATIO = 0.6;

function normalizeDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveSleepScore(record: SleepRecordLike | undefined): number | null {
  if (!record) return null;
  if (typeof record.score_breakdown?.score === 'number') {
    return Math.round(record.score_breakdown.score);
  }
  if (typeof record.sleep_score === 'number') {
    return Math.round(record.sleep_score);
  }
  return null;
}

function getWeekStart(selectedDate: Date): Date {
  const start = new Date(selectedDate);
  start.setHours(12, 0, 0, 0);
  const jsDay = start.getDay();
  const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
  start.setDate(start.getDate() - mondayOffset);
  return start;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const safe = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized;

  return {
    r: parseInt(safe.slice(0, 2), 16),
    g: parseInt(safe.slice(2, 4), 16),
    b: parseInt(safe.slice(4, 6), 16),
  };
}

function toHexColor(color: { r: number; g: number; b: number }): string {
  return `#${clampChannel(color.r).toString(16).padStart(2, '0')}${clampChannel(color.g)
    .toString(16)
    .padStart(2, '0')}${clampChannel(color.b).toString(16).padStart(2, '0')}`;
}

function blendHexColors(primary: string, secondary: string, ratio: number): string {
  const primaryRgb = parseHexColor(primary);
  const secondaryRgb = parseHexColor(secondary);
  const inverseRatio = 1 - ratio;

  return toHexColor({
    r: primaryRgb.r * ratio + secondaryRgb.r * inverseRatio,
    g: primaryRgb.g * ratio + secondaryRgb.g * inverseRatio,
    b: primaryRgb.b * ratio + secondaryRgb.b * inverseRatio,
  });
}

function buildRecordMap(
  recentHistory: readonly SleepRecordLike[],
  monthlyData: Readonly<Record<string, readonly SleepRecordLike[] | undefined>>
): Map<string, SleepRecordLike> {
  const records = new Map<string, SleepRecordLike>();

  recentHistory.forEach((record) => {
    records.set(record.date, record);
  });

  Object.values(monthlyData).forEach((monthRecords) => {
    monthRecords?.forEach((record) => {
      if (!records.has(record.date)) {
        records.set(record.date, record);
      }
    });
  });

  return records;
}

/**
 * Example: calculateWeeklyDelta(84, [80, 82, 84, 86, null, 78, 80], 2) -> 4
 */
export function calculateWeeklyDelta(
  todayScore: number | undefined,
  weekScores: (number | null)[],
  todayIndex: number
): number | null {
  if (todayScore === undefined || todayScore === null) return null;

  const priorScores = weekScores.filter((score, index): score is number => {
    return index !== todayIndex && typeof score === 'number';
  });

  if (priorScores.length < 3) return null;

  const average = priorScores.reduce((sum, score) => sum + score, 0) / priorScores.length;
  if (average === 0) return null;

  return Math.round(((todayScore - average) / average) * 100);
}

/**
 * Example: deriveWeekSeries([{ date: '2026-03-31', duration_minutes: 480 }], {}, new Date('2026-04-02'))
 * -> durations for the Mon-Sun week containing Apr 2, preserving the Mar 31 record across the month boundary.
 */
export function deriveWeekSeries(
  recentHistory: readonly SleepRecordLike[],
  monthlyData: Readonly<Record<string, readonly SleepRecordLike[] | undefined>>,
  selectedDate: Date
): WeekSeriesData {
  const recordMap = buildRecordMap(recentHistory, monthlyData);
  const weekStart = getWeekStart(selectedDate);
  const todayIndex = (() => {
    const jsDay = selectedDate.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  })();

  const durations: (number | null)[] = [];
  const bedtimes: (number | null)[] = [];
  const wakeTimes: (number | null)[] = [];
  const scores: (number | null)[] = [];

  for (let index = 0; index < WEEK_LENGTH; index += 1) {
    const current = new Date(weekStart);
    current.setDate(weekStart.getDate() + index);
    const key = normalizeDateKey(current);
    const record = recordMap.get(key);

    durations.push(record?.duration_minutes ?? null);
    bedtimes.push(toBedtimeMinutes(record?.start_time ?? null));
    wakeTimes.push(toWakeMinutes(record?.end_time ?? null));
    scores.push(resolveSleepScore(record));
  }

  return {
    durations,
    bedtimes,
    wakeTimes,
    scores,
    todayIndex: Math.max(MONDAY_INDEX, Math.min(WEEK_LENGTH - 1, todayIndex)),
  };
}

/**
 * Example: toBedtimeMinutes('2026-03-17T00:30:00.000Z') -> 1470
 */
export function toBedtimeMinutes(iso: string | null): number | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  let minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes < BEDTIME_NOON_MINUTES) {
    minutes += 24 * 60;
  }
  return minutes;
}

/**
 * Example: toWakeMinutes('2026-03-17T07:15:00.000Z') -> 435
 */
export function toWakeMinutes(iso: string | null): number | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Example: getHeroGradientStops('#22c55e').primary -> a 60/40 blend of the score color and base hero green.
 */
export function getHeroGradientStops(gradeColor: string): HeroGradientStops {
  return {
    primary: blendHexColors(
      gradeColor,
      SLEEP_THEME.heroGradientPrimary,
      GRADE_BLEND_RATIO
    ),
    mid: SLEEP_THEME.heroGradientMid,
    end: SLEEP_THEME.heroGradientEnd,
  };
}
