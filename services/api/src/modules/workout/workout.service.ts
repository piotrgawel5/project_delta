import { config } from "../../config";
import { AppError } from "../../utils/AppError";
import type { WorkoutSession } from "../../types/workout";

// TODO: wire up Supabase client (same pattern as sleep.service.ts)
// const supabase = createClient(config.supabase.url!, config.supabase.serviceRoleKey!);

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all workout sessions for a user within an optional date range.
 * TODO: implement Supabase query joining workout_sessions → workout_exercise_logs → workout_sets
 */
export async function fetchSessions(
  userId: string,
  from?: string,
  to?: string
): Promise<WorkoutSession[]> {
  void userId;
  void from;
  void to;
  throw new AppError("Not implemented", 501);
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert a completed workout session (idempotent by session.id).
 * TODO: upsert workout_sessions row, then upsert exercise logs and sets in transaction.
 * Ownership is enforced by matching session.userId === req.user.id before calling.
 */
export async function saveSession(
  session: WorkoutSession,
  userId: string
): Promise<void> {
  void session;
  void userId;
  throw new AppError("Not implemented", 501);
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Delete a workout session and cascade to exercise logs and sets.
 * TODO: verify ownership (session.user_id = userId) before deleting.
 */
export async function deleteSession(
  sessionId: string,
  userId: string
): Promise<void> {
  void sessionId;
  void userId;
  throw new AppError("Not implemented", 501);
}
