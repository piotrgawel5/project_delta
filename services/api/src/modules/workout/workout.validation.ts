import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const WorkoutSetSchema = z.object({
  id: z.string().uuid(),
  setNumber: z.number().int().min(1),
  reps: z.number().int().min(0).nullable(),
  weightKg: z.number().min(0).nullable(),
  durationSeconds: z.number().int().min(0).nullable(),
  completedAt: z.string().datetime(),
  rpe: z.number().min(1).max(10).nullable(),
});

const WorkoutExerciseLogSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.array(WorkoutSetSchema),
  notes: z.string().max(500).nullable(),
});

const WorkoutSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string().date(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(0).nullable(),
  exercises: z.array(WorkoutExerciseLogSchema),
  notes: z.string().max(1000).nullable(),
  name: z.string().max(100).nullable(),
  feelRating: z.number().int().min(1).max(4).nullable(),
  difficultyRating: z.number().int().min(1).max(4).nullable(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Request schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/workout/sessions
 * Body: single completed session (idempotent by session.id)
 */
export const workoutSessionSyncSchema = z.object({
  body: z.object({
    session: WorkoutSessionSchema,
  }),
});
export type WorkoutSessionSync = z.infer<typeof workoutSessionSyncSchema>["body"];

/**
 * GET /api/workout/sessions/:userId
 * Query: date range filter
 */
export const workoutSessionsQuerySchema = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }),
});

/**
 * DELETE /api/workout/sessions/:id
 */
export const workoutSessionDeleteSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
