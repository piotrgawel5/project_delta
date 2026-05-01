import type { WorkoutSession, WorkoutSet } from '@shared';

export interface MonthPRs {
  count: number;
  weekBars: readonly (0 | 1)[]; // 12 buckets, oldest → newest
}

interface SetWithExercise {
  exerciseId: string;
  set: WorkoutSet;
  ts: number; // ms epoch
}

function flatten(sessions: WorkoutSession[]): SetWithExercise[] {
  const out: SetWithExercise[] = [];
  for (const s of sessions) {
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (set.weightKg == null || !set.completedAt) continue;
        out.push({ exerciseId: ex.exerciseId, set, ts: Date.parse(set.completedAt) });
      }
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}

export interface SessionPR {
  exerciseId: string;
  weightKg: number;
  reps: number | null;
  previousBestKg: number;
}

// Detects PRs for a single (just-finished) session, comparing each exercise's
// heaviest weight against the user's prior best across `priorSessions`.
// Returns one PR entry per exercise that surpassed its prior best (no first-
// ever lift is counted as a PR — matches computeMonthPRs).
export function detectSessionPRs(
  session: WorkoutSession,
  priorSessions: WorkoutSession[],
): SessionPR[] {
  const bestByExercise = new Map<string, number>();
  for (const s of priorSessions) {
    if (s.id === session.id) continue;
    for (const ex of s.exercises) {
      for (const set of ex.sets) {
        if (set.weightKg == null) continue;
        const cur = bestByExercise.get(ex.exerciseId) ?? 0;
        if (set.weightKg > cur) bestByExercise.set(ex.exerciseId, set.weightKg);
      }
    }
  }

  const prs: SessionPR[] = [];
  for (const ex of session.exercises) {
    let topSet: { weightKg: number; reps: number | null } | null = null;
    for (const set of ex.sets) {
      if (set.weightKg == null) continue;
      if (!topSet || set.weightKg > topSet.weightKg) {
        topSet = { weightKg: set.weightKg, reps: set.reps };
      }
    }
    if (!topSet) continue;
    const prev = bestByExercise.get(ex.exerciseId) ?? 0;
    if (prev > 0 && topSet.weightKg > prev) {
      prs.push({
        exerciseId: ex.exerciseId,
        weightKg: topSet.weightKg,
        reps: topSet.reps,
        previousBestKg: prev,
      });
    }
  }
  return prs;
}

export function computeMonthPRs(sessions: WorkoutSession[]): MonthPRs {
  const all = flatten(sessions);
  const bestByExercise = new Map<string, number>();
  const prTimestamps: number[] = [];

  for (const item of all) {
    const w = item.set.weightKg;
    if (w == null) continue;
    const prev = bestByExercise.get(item.exerciseId) ?? 0;
    if (w > prev) {
      bestByExercise.set(item.exerciseId, w);
      if (prev > 0) prTimestamps.push(item.ts); // first-ever lift isn't a "PR"
    }
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  const monthMs = monthEnd - monthStart;
  const bucketMs = monthMs / 12;

  const weekBars: (0 | 1)[] = Array(12).fill(0) as (0 | 1)[];
  let count = 0;
  for (const ts of prTimestamps) {
    if (ts < monthStart || ts > monthEnd) continue;
    count++;
    const idx = Math.min(11, Math.max(0, Math.floor((ts - monthStart) / bucketMs)));
    weekBars[idx] = 1;
  }

  return { count, weekBars };
}
