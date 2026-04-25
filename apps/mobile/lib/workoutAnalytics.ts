import type { MuscleGroup, MuscleIntensity, WorkoutSession } from "@shared";
import { getExerciseById } from "./workoutFixtures";

const ALL_MUSCLES: MuscleGroup[] = [
  "chest", "front_delts", "side_delts", "rear_delts",
  "biceps", "triceps", "forearms",
  "upper_back", "lats", "lower_back", "traps",
  "abs", "obliques",
  "quads", "hamstrings", "glutes", "calves", "hip_flexors",
];

// ─────────────────────────────────────────────────────────────────────────────
// Muscle Heatmap
// ─────────────────────────────────────────────────────────────────────────────

// Primary muscle counts as 1.0, secondary as 0.5. Buckets: 0=untrained,
// 1=light (<2), 2=moderate (<5), 3=heavy/overtraining risk (≥5).
export function computeMuscleHeatmap(
  sessions: WorkoutSession[],
  lookbackDays: number,
): Record<MuscleGroup, MuscleIntensity> {
  const result = Object.fromEntries(
    ALL_MUSCLES.map((m) => [m, 0 as MuscleIntensity]),
  ) as Record<MuscleGroup, MuscleIntensity>;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  cutoff.setHours(0, 0, 0, 0);

  const scores: Partial<Record<MuscleGroup, number>> = {};

  for (const session of sessions) {
    if (new Date(session.date) < cutoff) continue;
    for (const log of session.exercises) {
      const exercise = getExerciseById(log.exerciseId);
      if (!exercise) continue;
      exercise.primaryMuscles.forEach((m) => {
        scores[m] = (scores[m] ?? 0) + 1.0;
      });
      exercise.secondaryMuscles.forEach((m) => {
        scores[m] = (scores[m] ?? 0) + 0.5;
      });
    }
  }

  for (const muscle of ALL_MUSCLES) {
    const s = scores[muscle] ?? 0;
    if (s === 0) result[muscle] = 0;
    else if (s < 2) result[muscle] = 1;
    else if (s < 5) result[muscle] = 2;
    else result[muscle] = 3;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Overtraining
// ─────────────────────────────────────────────────────────────────────────────

// Returns true if the muscle appears as a primary target in more than 3
// sessions within any rolling 7-day window.
export function isOvertrained(muscle: MuscleGroup, sessions: WorkoutSession[]): boolean {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  let count = 0;
  for (const session of sessions) {
    if (new Date(session.date) < sevenDaysAgo) continue;
    const touched = session.exercises.some((log) => {
      const exercise = getExerciseById(log.exerciseId);
      return exercise?.primaryMuscles.includes(muscle) ?? false;
    });
    if (touched) count++;
  }
  return count > 3;
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume
// ─────────────────────────────────────────────────────────────────────────────

// Total completed sets across all sessions in the past 7 days.
export function computeWeeklyVolume(sessions: WorkoutSession[]): number {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  return sessions
    .filter((s) => new Date(s.date) >= sevenDaysAgo)
    .reduce((acc, s) => acc + getTotalSets(s), 0);
}

// Sets per day for the current Mon–Sun week, indexed 0 (Mon) → 6 (Sun).
export function computeDailyVolumeSeries(sessions: WorkoutSession[]): number[] {
  const result = [0, 0, 0, 0, 0, 0, 0];

  const today = new Date();
  const monday = new Date(today);
  // getDay(): 0=Sun, 1=Mon … 6=Sat → shift so Mon=0
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 7);

  for (const session of sessions) {
    const sessionDate = new Date(session.date);
    if (sessionDate < monday || sessionDate >= weekEnd) continue;
    const dayIndex = Math.floor(
      (sessionDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (dayIndex >= 0 && dayIndex < 7) {
      result[dayIndex] += getTotalSets(session);
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Neglected Muscles
// ─────────────────────────────────────────────────────────────────────────────

// Returns muscles (primary only) not trained in the past `thresholdDays`.
export function getNeglectedMuscles(
  sessions: WorkoutSession[],
  thresholdDays = 7,
): MuscleGroup[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);
  cutoff.setHours(0, 0, 0, 0);

  const recentlyTrained = new Set<MuscleGroup>();

  for (const session of sessions) {
    if (new Date(session.date) < cutoff) continue;
    for (const log of session.exercises) {
      const exercise = getExerciseById(log.exerciseId);
      exercise?.primaryMuscles.forEach((m) => recentlyTrained.add(m));
    }
  }

  return ALL_MUSCLES.filter((m) => !recentlyTrained.has(m));
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

export function getTotalSets(session: WorkoutSession): number {
  return session.exercises.reduce((acc, log) => acc + log.sets.length, 0);
}
