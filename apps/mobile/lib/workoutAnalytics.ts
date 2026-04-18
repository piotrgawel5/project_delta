import type { MuscleGroup, MuscleIntensity, WorkoutSession } from "@shared";
import { getExerciseById } from "./workoutFixtures";

// ─────────────────────────────────────────────────────────────────────────────
// Muscle Heatmap
// ─────────────────────────────────────────────────────────────────────────────

const ALL_MUSCLES: MuscleGroup[] = [
  "chest", "front_delts", "side_delts", "rear_delts",
  "biceps", "triceps", "forearms",
  "upper_back", "lats", "lower_back", "traps",
  "abs", "obliques",
  "quads", "hamstrings", "glutes", "calves", "hip_flexors",
];

// Returns a muscle → intensity map for the muscle map component.
// Intensity is derived from how many times each muscle appears across sessions
// within the lookback window, weighted by primary (1.0) vs secondary (0.5).
export function computeMuscleHeatmap(
  sessions: WorkoutSession[],
  lookbackDays: number
): Record<MuscleGroup, MuscleIntensity> {
  const result = Object.fromEntries(
    ALL_MUSCLES.map((m) => [m, 0 as MuscleIntensity])
  ) as Record<MuscleGroup, MuscleIntensity>;

  // Stub: returns all untrained until backend is live
  void sessions;
  void lookbackDays;
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overtraining
// ─────────────────────────────────────────────────────────────────────────────

// A muscle is considered overtrained if it appears as primary in more than
// 3 sessions in any rolling 7-day window OR more than 6 sessions in 14 days.
export function isOvertrained(
  muscle: MuscleGroup,
  sessions: WorkoutSession[]
): boolean {
  // Stub: returns false until backend is live
  void muscle;
  void sessions;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume
// ─────────────────────────────────────────────────────────────────────────────

// Total completed sets across all exercises in the given sessions.
export function computeWeeklyVolume(sessions: WorkoutSession[]): number {
  // Stub: returns 0 until backend is live
  void sessions;
  return 0;
}

// Total sets per day for a Mon–Sun week, indexed 0 (Mon) → 6 (Sun).
export function computeDailyVolumeSeries(sessions: WorkoutSession[]): number[] {
  // Stub: returns zeroes until backend is live
  void sessions;
  return [0, 0, 0, 0, 0, 0, 0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Neglected Muscles
// ─────────────────────────────────────────────────────────────────────────────

// Returns muscles not trained in the past `thresholdDays`.
export function getNeglectedMuscles(
  sessions: WorkoutSession[],
  thresholdDays = 7
): MuscleGroup[] {
  // Stub: returns empty list until backend is live
  void sessions;
  void thresholdDays;
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Helpers
// ─────────────────────────────────────────────────────────────────────────────

// All muscles touched by a single session (primary + secondary, deduplicated).
export function getSessionMuscles(session: WorkoutSession): MuscleGroup[] {
  const muscles = new Set<MuscleGroup>();
  for (const log of session.exercises) {
    const exercise = getExerciseById(log.exerciseId);
    if (!exercise) continue;
    exercise.primaryMuscles.forEach((m) => muscles.add(m));
    exercise.secondaryMuscles.forEach((m) => muscles.add(m));
  }
  return Array.from(muscles);
}

// Total sets in a single session.
export function getTotalSets(session: WorkoutSession): number {
  return session.exercises.reduce((acc, log) => acc + log.sets.length, 0);
}
