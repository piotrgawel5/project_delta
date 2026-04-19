import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { requireOwnership } from "../../middleware/authorization";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { burstLimiter, userReadLimiter, userWriteLimiter } from "../../middleware/rateLimiter";
import { workoutController } from "./workout.controller";
import {
  workoutSessionDeleteSchema,
  workoutSessionSyncSchema,
  workoutSessionsQuerySchema,
} from "./workout.validation";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/workout/sessions/:userId
 * Fetch session history. Query params: from (YYYY-MM-DD), to (YYYY-MM-DD).
 * Defaults to last 90 days when no range specified.
 */
router.get(
  "/sessions/:userId",
  requireAuth,
  requireOwnership,
  burstLimiter,
  userReadLimiter,
  validate(workoutSessionsQuerySchema),
  asyncHandler((req, res) => workoutController.getSessions(req, res))
);

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/workout/sessions
 * Sync a completed workout session (idempotent by session.id).
 * Body: { session: WorkoutSession }
 */
router.post(
  "/sessions",
  requireAuth,
  burstLimiter,
  userWriteLimiter,
  validate(workoutSessionSyncSchema),
  asyncHandler((req, res) => workoutController.syncSession(req, res))
);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DELETE /api/workout/sessions/:id
 * Delete a workout session and all associated exercise logs and sets.
 */
router.delete(
  "/sessions/:id",
  requireAuth,
  burstLimiter,
  userWriteLimiter,
  validate(workoutSessionDeleteSchema),
  asyncHandler((req, res) => workoutController.deleteSession(req, res))
);

export const workoutRoutes = router;
