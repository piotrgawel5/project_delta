import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { AppError } from "../../utils/AppError";
import type { WorkoutSession, WorkoutExerciseLog, WorkoutSet } from "../../types/workout";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client (service role — bypasses RLS, ownership enforced in queries)
// ─────────────────────────────────────────────────────────────────────────────

function getClient(): SupabaseClient {
  return createClient(config.supabase.url!, config.supabase.serviceRoleKey!);
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row shapes (snake_case)
// ─────────────────────────────────────────────────────────────────────────────

interface SetRow {
  id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  completed_at: string;
}

interface LogRow {
  id: string;
  exercise_id: string;
  exercise_order: number;
  notes: string | null;
  workout_sets: SetRow[];
}

interface SessionRow {
  id: string;
  user_id: string;
  date: string;
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  name: string | null;
  notes: string | null;
  feel_rating: number | null;
  difficulty_rating: number | null;
  workout_exercise_logs: LogRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers (DB rows → domain types)
// ─────────────────────────────────────────────────────────────────────────────

function mapSet(row: SetRow): WorkoutSet {
  return {
    id: row.id,
    setNumber: row.set_number,
    reps: row.reps,
    weightKg: row.weight_kg,
    durationSeconds: row.duration_seconds,
    rpe: row.rpe,
    completedAt: row.completed_at,
  };
}

function mapLog(row: LogRow): WorkoutExerciseLog {
  return {
    exerciseId: row.exercise_id,
    sets: (row.workout_sets ?? [])
      .sort((a, b) => a.set_number - b.set_number)
      .map(mapSet),
    notes: row.notes,
  };
}

function mapSession(row: SessionRow): WorkoutSession {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    name: row.name,
    notes: row.notes,
    feelRating: row.feel_rating,
    difficultyRating: row.difficulty_rating,
    exercises: (row.workout_exercise_logs ?? [])
      .sort((a, b) => a.exercise_order - b.exercise_order)
      .map(mapLog),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSessions(
  userId: string,
  from?: string,
  to?: string,
): Promise<WorkoutSession[]> {
  const supabase = getClient();

  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(
      `id, user_id, date, started_at, finished_at, duration_seconds,
       name, notes, feel_rating, difficulty_rating,
       workout_exercise_logs (
         id, exercise_id, exercise_order, notes,
         workout_sets ( id, set_number, reps, weight_kg, duration_seconds, rpe, completed_at )
       )`,
    )
    .eq("user_id", userId)
    .gte("date", from ?? defaultFrom)
    .lte("date", to ?? today)
    .order("date", { ascending: false });

  if (error) {
    throw AppError.internal(`Failed to fetch workout sessions: ${error.message}`);
  }

  return ((data ?? []) as SessionRow[]).map(mapSession);
}

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

export async function saveSession(
  session: WorkoutSession,
  userId: string,
): Promise<void> {
  if (session.userId !== userId) {
    throw AppError.forbidden("Cannot save another user's session");
  }

  const supabase = getClient();

  // Single atomic RPC — Postgres function upserts session + replaces logs + sets
  // inside one implicit transaction. Replaces the previous 4-step write that
  // could leave orphan rows on partial failure.
  const { error } = await supabase.rpc("save_workout_session", {
    p_session: session,
    p_user_id: userId,
  });

  if (error) {
    if (error.code === "42501" || error.message.toLowerCase().includes("forbidden")) {
      throw AppError.forbidden("Cannot save another user's session");
    }
    throw AppError.internal(`Failed to save workout session: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  const supabase = getClient();

  // Verify ownership before deleting
  const { data: session, error: fetchErr } = await supabase
    .from("workout_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .single();

  if (fetchErr || !session) {
    throw AppError.notFound("Workout session not found");
  }

  if ((session as { user_id: string }).user_id !== userId) {
    throw AppError.forbidden("Cannot delete another user's session");
  }

  const { error: deleteErr } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", sessionId);

  if (deleteErr) {
    throw AppError.internal(`Failed to delete workout session: ${deleteErr.message}`);
  }
}
