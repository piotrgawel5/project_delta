// ─────────────────────────────────────────────────────────────────────────────
// Muscle Groups
// ─────────────────────────────────────────────────────────────────────────────

export type MuscleGroup =
  | "chest"
  | "front_delts"
  | "side_delts"
  | "rear_delts"
  | "biceps"
  | "triceps"
  | "forearms"
  | "upper_back"
  | "lats"
  | "lower_back"
  | "traps"
  | "abs"
  | "obliques"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "hip_flexors";

// 0 = untrained, 1 = light, 2 = moderate, 3 = heavy / overtraining risk
export type MuscleIntensity = 0 | 1 | 2 | 3;

// ─────────────────────────────────────────────────────────────────────────────
// Exercise
// ─────────────────────────────────────────────────────────────────────────────

export type ExerciseCategory =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "core"
  | "cardio"
  | "full_body";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "bands"
  | "other";

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  /**
   * Optional in the data source — `getExerciseEquipment(id)` infers from the id
   * when omitted, so legacy entries don't break.
   */
  equipment?: Equipment;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workout Session
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkoutSet {
  id: string;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  completedAt: string; // ISO timestamp
  rpe: number | null;  // 1–10 rate of perceived exertion
}

export interface WorkoutExerciseLog {
  exerciseId: string;
  sets: WorkoutSet[];
  notes: string | null;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  date: string;              // YYYY-MM-DD
  startedAt: string;         // ISO timestamp
  finishedAt: string | null; // null while in progress
  durationSeconds: number | null;
  exercises: WorkoutExerciseLog[];
  notes: string | null;
  name: string | null;              // user-provided session name, e.g. "Morning workout"
  feelRating: number | null;        // 1–4 (1=Rough, 2=OK, 3=Good, 4=Great)
  difficultyRating: number | null;  // 1–4 (1=Easy, 2=Moderate, 3=Hard, 4=Full Effort)
}

// Zod schemas for these types live in services/api/src/modules/workout/workout.validation.ts
