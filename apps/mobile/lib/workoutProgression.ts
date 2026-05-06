// lib/workoutProgression.ts
//
// Deterministic progression suggester for the quick-log flow.
//
// Rules:
//   • If every set in the previous session hit its rep target with RPE ≤ 8,
//     suggest +2.5 kg on the top set; the rest stay flat.
//   • Otherwise, repeat the previous session as-is (no overload).
//   • Per-week cap: never recommend more than +5 kg over the same exercise's
//     7-day-prior weight; if the most recent two sessions have already added
//     5 kg, stay flat.
//   • Bodyweight or duration-only sets (weightKg == null) are repeated.
//
// Pure: no store reads, no I/O. The caller passes the recent session history
// already filtered for `exerciseId`.

import type { WorkoutSession, WorkoutSet } from '@shared';

export interface ProgressionSuggestion {
  /** What to log for each set, in order. */
  sets: SuggestedSet[];
  /** One-line, user-facing rationale string. */
  rationale: string;
  /** True iff this suggestion adds load over the previous session. */
  isOverload: boolean;
}

export interface SuggestedSet {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  rpe: number | null;
}

const STEP_KG = 2.5;
const WEEKLY_CAP_KG = 5;
const RPE_OVERLOAD_CEILING = 8;

/**
 * @param sessionsForExercise — sessions that contain this exercise, newest first.
 *        Sessions without the exercise must be filtered out by the caller.
 */
export function suggestNextSession(
  sessionsForExercise: WorkoutSession[],
  exerciseId: string,
): ProgressionSuggestion | null {
  const prev = findExerciseLog(sessionsForExercise[0], exerciseId);
  if (!prev || prev.length === 0) return null;

  const allHit = prev.every(setHitTarget);
  const topSetIdx = topSetIndex(prev);
  const topSetWeight = prev[topSetIdx]?.weightKg ?? null;

  // Bodyweight / duration-only — repeat as-is.
  if (topSetWeight == null) {
    return {
      sets: prev.map(toSuggested),
      rationale: 'Repeat last session — no weight to add.',
      isOverload: false,
    };
  }

  if (!allHit) {
    return {
      sets: prev.map(toSuggested),
      rationale: 'Repeat last session — last attempt left reps on the table.',
      isOverload: false,
    };
  }

  // Weekly cap: compare against the heaviest top-set ≥7 days before the most recent.
  const mostRecentDate = sessionsForExercise[0].date;
  const olderTopWeight = topWeightAtLeastSevenDaysBefore(
    sessionsForExercise,
    exerciseId,
    mostRecentDate,
  );
  const proposed = topSetWeight + STEP_KG;
  if (olderTopWeight != null && proposed - olderTopWeight > WEEKLY_CAP_KG) {
    return {
      sets: prev.map(toSuggested),
      rationale: `Hold at ${topSetWeight} kg — already +${WEEKLY_CAP_KG} kg this week.`,
      isOverload: false,
    };
  }

  const sets = prev.map((s, i) =>
    i === topSetIdx
      ? { ...toSuggested(s), weightKg: proposed }
      : toSuggested(s),
  );

  return {
    sets,
    rationale: `+${STEP_KG} kg on top set (${proposed} kg).`,
    isOverload: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function findExerciseLog(session: WorkoutSession | undefined, exerciseId: string): WorkoutSet[] | null {
  if (!session) return null;
  const log = session.exercises.find((e) => e.exerciseId === exerciseId);
  return log?.sets ?? null;
}

function setHitTarget(set: WorkoutSet): boolean {
  // Reps-based: rep target hit when reps > 0 and RPE (if recorded) ≤ ceiling.
  if (set.reps != null && set.reps > 0) {
    if (set.rpe == null) return true;
    return set.rpe <= RPE_OVERLOAD_CEILING;
  }
  // Duration-based or bodyweight without reps: treat as completed.
  return set.durationSeconds != null && set.durationSeconds > 0;
}

function topSetIndex(sets: WorkoutSet[]): number {
  let idx = 0;
  let max = -Infinity;
  for (let i = 0; i < sets.length; i++) {
    const w = sets[i].weightKg ?? -Infinity;
    if (w > max) {
      max = w;
      idx = i;
    }
  }
  return idx;
}

function toSuggested(s: WorkoutSet): SuggestedSet {
  return {
    reps: s.reps,
    weightKg: s.weightKg,
    durationSeconds: s.durationSeconds,
    rpe: null,
  };
}

function topWeightAtLeastSevenDaysBefore(
  sessions: WorkoutSession[],
  exerciseId: string,
  mostRecentDate: string,
): number | null {
  const cutoff = addDays(mostRecentDate, -7);
  for (const session of sessions) {
    if (session.date > cutoff) continue;
    const sets = findExerciseLog(session, exerciseId);
    if (!sets || sets.length === 0) continue;
    const w = sets[topSetIndex(sets)].weightKg;
    if (w != null) return w;
  }
  return null;
}

function addDays(date: string, deltaDays: number): string {
  const d = new Date(date + 'T00:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
