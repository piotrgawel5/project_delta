-- ─────────────────────────────────────────────────────────────────────────────
-- save_workout_session(jsonb, uuid)
--
-- Atomic upsert of a complete workout session payload (session row + all
-- exercise logs + all sets). Replaces the multi-step write previously done
-- in services/api/src/modules/workout/workout.service.ts so that partial
-- failures (e.g. logs deleted but sets-insert fails) cannot leave orphan
-- session rows.
--
-- Postgres functions execute inside a single implicit transaction; any RAISE
-- rolls the whole call back, including the cascading DELETE.
--
-- Ownership is enforced inside the function: the caller's auth user id must
-- match the session.userId in the payload. Service role calls bypass RLS but
-- are still subject to this check (passed in by the API).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION save_workout_session(
  p_session jsonb,
  p_user_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session_id uuid := (p_session->>'id')::uuid;
  v_log        jsonb;
  v_log_idx    int := 0;
  v_log_id     uuid;
  v_set        jsonb;
BEGIN
  -- 1. Ownership check
  IF (p_session->>'userId')::uuid <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- 2. Upsert session row (idempotent by id)
  INSERT INTO workout_sessions (
    id, user_id, date, started_at, finished_at, duration_seconds,
    name, notes, feel_rating, difficulty_rating
  ) VALUES (
    v_session_id,
    p_user_id,
    (p_session->>'date')::date,
    (p_session->>'startedAt')::timestamptz,
    NULLIF(p_session->>'finishedAt', '')::timestamptz,
    NULLIF(p_session->>'durationSeconds', '')::int,
    NULLIF(p_session->>'name', ''),
    NULLIF(p_session->>'notes', ''),
    NULLIF(p_session->>'feelRating', '')::smallint,
    NULLIF(p_session->>'difficultyRating', '')::smallint
  )
  ON CONFLICT (id) DO UPDATE SET
    date              = EXCLUDED.date,
    started_at        = EXCLUDED.started_at,
    finished_at       = EXCLUDED.finished_at,
    duration_seconds  = EXCLUDED.duration_seconds,
    name              = EXCLUDED.name,
    notes             = EXCLUDED.notes,
    feel_rating       = EXCLUDED.feel_rating,
    difficulty_rating = EXCLUDED.difficulty_rating;

  -- 3. Clear existing exercise logs (cascade clears sets) — makes re-sync idempotent
  DELETE FROM workout_exercise_logs WHERE session_id = v_session_id;

  -- 4. Re-insert logs (skipping any with zero sets) and their sets
  FOR v_log IN SELECT * FROM jsonb_array_elements(COALESCE(p_session->'exercises', '[]'::jsonb))
  LOOP
    v_log_idx := v_log_idx + 1;

    -- Skip exercises with no sets — keeps DB clean of placeholder entries
    IF jsonb_array_length(COALESCE(v_log->'sets', '[]'::jsonb)) = 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO workout_exercise_logs (
      session_id, exercise_id, exercise_order, notes
    ) VALUES (
      v_session_id,
      v_log->>'exerciseId',
      v_log_idx,
      NULLIF(v_log->>'notes', '')
    )
    RETURNING id INTO v_log_id;

    FOR v_set IN SELECT * FROM jsonb_array_elements(v_log->'sets')
    LOOP
      INSERT INTO workout_sets (
        log_id, set_number, reps, weight_kg, duration_seconds, rpe, completed_at
      ) VALUES (
        v_log_id,
        (v_set->>'setNumber')::int,
        NULLIF(v_set->>'reps', '')::int,
        NULLIF(v_set->>'weightKg', '')::numeric,
        NULLIF(v_set->>'durationSeconds', '')::int,
        NULLIF(v_set->>'rpe', '')::numeric,
        (v_set->>'completedAt')::timestamptz
      );
    END LOOP;
  END LOOP;
END;
$$;

-- The API calls this with the service role key; allow service_role to invoke.
GRANT EXECUTE ON FUNCTION save_workout_session(jsonb, uuid) TO service_role;
