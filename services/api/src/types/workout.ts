// Local workout types for the API service.
// Mirror of packages/shared/src/types/workout.ts — keep in sync.

export interface WorkoutSet {
  id: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  completedAt: string;
  rpe: number | null;
}

export interface WorkoutExerciseLog {
  exerciseId: string;
  sets: WorkoutSet[];
  notes: string | null;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  date: string;
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  exercises: WorkoutExerciseLog[];
  notes: string | null;
  name: string | null;
  feelRating: number | null;
  difficultyRating: number | null;
}
