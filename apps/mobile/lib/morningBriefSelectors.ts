// lib/morningBriefSelectors.ts
//
// Pure selectors that turn the live store state into the shape consumed by
// `buildMorningBrief`. Kept separate from the composer so the composer stays
// fully unit-testable with hand-built inputs (no store mocking).

import type { MuscleGroup, NutritionLog, WorkoutSession } from '@shared';
import { getExerciseById } from './workoutFixtures';
import type {
  MorningBriefInput,
  MorningBriefMealEntry,
  MorningBriefProfile,
  MorningBriefSession,
  MorningBriefSleepNight,
} from './morningBrief';

const LEG_MUSCLES: ReadonlySet<MuscleGroup> = new Set([
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'hip_flexors',
]);

interface SleepRecordLike {
  date: string;
  duration_minutes?: number | null;
  deep_sleep_minutes?: number | null;
}

interface ProfileLike {
  weight_value?: number | null;
  weight_unit?: 'kg' | 'lbs' | null;
}

function lbsToKg(lbs: number): number {
  return lbs / 2.2046226218;
}

export function selectSleepNight(
  recentHistory: SleepRecordLike[],
  todayDate: string,
): MorningBriefSleepNight | null {
  const sorted = [...recentHistory].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted.find((r) => r.date <= todayDate) ?? null;
  if (!latest || latest.duration_minutes == null) return null;
  return {
    durationMinutes: latest.duration_minutes,
    deepMinutes: latest.deep_sleep_minutes ?? 0,
  };
}

export function selectLast7DaysDeep(recentHistory: SleepRecordLike[], todayDate: string): number[] {
  const sorted = [...recentHistory]
    .filter((r) => r.date < todayDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  return sorted
    .map((r) => r.deep_sleep_minutes ?? 0)
    .filter((m): m is number => Number.isFinite(m) && m > 0);
}

export function selectRecentSessions(
  sessions: WorkoutSession[],
  todayDate: string,
): MorningBriefSession[] {
  const cutoff = addDays(todayDate, -7);
  return sessions
    .filter((s) => s.date > cutoff && s.date <= todayDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => {
      let totalSets = 0;
      let legSetCount = 0;
      for (const log of s.exercises) {
        const exercise = getExerciseById(log.exerciseId);
        const setCount = log.sets.length;
        totalSets += setCount;
        const muscles = exercise?.primaryMuscles ?? [];
        if (muscles.some((m) => LEG_MUSCLES.has(m))) legSetCount += setCount;
      }
      return { date: s.date, totalSets, legSetCount };
    });
}

export function selectRecentMeals(
  logsByDate: Record<string, NutritionLog[]>,
  todayDate: string,
): MorningBriefMealEntry[] {
  const cutoff = addDays(todayDate, -7);
  const out: MorningBriefMealEntry[] = [];
  for (const [date, logs] of Object.entries(logsByDate)) {
    if (date <= cutoff || date > todayDate) continue;
    for (const l of logs) {
      out.push({ loggedAt: l.loggedAt, date: l.date, proteinG: l.proteinG });
    }
  }
  return out;
}

export function selectMorningBriefProfile(profile: ProfileLike | null): MorningBriefProfile {
  if (!profile || profile.weight_value == null) return { weightKg: null };
  const kg = profile.weight_unit === 'lbs'
    ? lbsToKg(profile.weight_value)
    : profile.weight_value;
  return { weightKg: kg };
}

export interface BuildInputArgs {
  todayDate: string;
  sleepHistory: SleepRecordLike[];
  sessions: WorkoutSession[];
  logsByDate: Record<string, NutritionLog[]>;
  profile: ProfileLike | null;
}

export function buildMorningBriefInput(args: BuildInputArgs): MorningBriefInput {
  return {
    lastNight: selectSleepNight(args.sleepHistory, args.todayDate),
    last7DaysDeepMinutes: selectLast7DaysDeep(args.sleepHistory, args.todayDate),
    recentSessions: selectRecentSessions(args.sessions, args.todayDate),
    recentMeals: selectRecentMeals(args.logsByDate, args.todayDate),
    profile: selectMorningBriefProfile(args.profile),
  };
}

function addDays(date: string, deltaDays: number): string {
  const d = new Date(date + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
