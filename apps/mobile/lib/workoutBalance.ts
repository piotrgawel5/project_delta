import type { MuscleGroup, WorkoutSession } from '@shared';
import { getExerciseById } from './workoutFixtures';

export interface PushPullSplit {
  pushPct: number;
  pullPct: number;
  pushSets: number;
  pullSets: number;
}

const PUSH_MUSCLES = new Set<MuscleGroup>([
  'chest',
  'front_delts',
  'side_delts',
  'triceps',
  'quads',
  'calves',
]);

const PULL_MUSCLES = new Set<MuscleGroup>([
  'upper_back',
  'lats',
  'lower_back',
  'rear_delts',
  'traps',
  'biceps',
  'hamstrings',
  'glutes',
]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computePushPullSplit(
  sessions: WorkoutSession[],
  lookbackDays = 14,
): PushPullSplit {
  const cutoff = Date.now() - lookbackDays * MS_PER_DAY;
  let pushSets = 0;
  let pullSets = 0;

  for (const s of sessions) {
    if (Date.parse(s.date) < cutoff) continue;
    for (const ex of s.exercises) {
      const def = getExerciseById(ex.exerciseId);
      if (!def) continue;
      const sets = ex.sets.length;
      if (sets === 0) continue;
      const isPush = def.primaryMuscles.some((m) => PUSH_MUSCLES.has(m));
      const isPull = def.primaryMuscles.some((m) => PULL_MUSCLES.has(m));
      if (isPush && !isPull) pushSets += sets;
      else if (isPull && !isPush) pullSets += sets;
    }
  }

  const total = pushSets + pullSets;
  if (total === 0) return { pushPct: 0, pullPct: 0, pushSets: 0, pullSets: 0 };

  const pushPct = Math.round((pushSets / total) * 100);
  return { pushPct, pullPct: 100 - pushPct, pushSets, pullSets };
}
