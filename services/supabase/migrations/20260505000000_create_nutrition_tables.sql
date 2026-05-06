-- ─────────────────────────────────────────────────────────────────────────────
-- Nutrition Tables
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Tables:
--   foods           — public catalog (Open Food Facts cache + user-defined + verified)
--   nutrition_logs  — per-user meal entries
--
-- Conventions match workout migration (20260418000000_create_workout_tables.sql):
--   - Service role bypasses RLS; policies are defence-in-depth.
--   - Log IDs are generated client-side (UUID) so offline sync is idempotent.
--   - Foods are read-public, write via service role only.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('open_food_facts', 'user', 'verified')),
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  kcal_per_100g NUMERIC(7,2) NOT NULL CHECK (kcal_per_100g >= 0),
  protein_per_100g NUMERIC(6,2) NOT NULL CHECK (protein_per_100g >= 0),
  carbs_per_100g NUMERIC(6,2) NOT NULL CHECK (carbs_per_100g >= 0),
  fats_per_100g NUMERIC(6,2) NOT NULL CHECK (fats_per_100g >= 0),
  locale TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE nutrition_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  -- Denormalized food snapshot — protects entries from later catalog edits.
  food_name TEXT NOT NULL,
  food_brand TEXT,
  grams NUMERIC(7,2) NOT NULL CHECK (grams >= 0),
  kcal NUMERIC(8,2) NOT NULL CHECK (kcal >= 0),
  protein_g NUMERIC(7,2) NOT NULL CHECK (protein_g >= 0),
  carbs_g NUMERIC(7,2) NOT NULL CHECK (carbs_g >= 0),
  fats_g NUMERIC(7,2) NOT NULL CHECK (fats_g >= 0),
  logged_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('open_food_facts', 'user', 'verified')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

-- foods: read public (catalog), write only via service role
CREATE POLICY "foods are readable by all authenticated users"
  ON foods FOR SELECT
  USING (auth.role() = 'authenticated');

-- nutrition_logs: users can only see/modify their own
CREATE POLICY "users own nutrition logs"
  ON nutrition_logs FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX idx_nutrition_logs_user_date
  ON nutrition_logs(user_id, date DESC);

CREATE INDEX idx_nutrition_logs_user_logged_at
  ON nutrition_logs(user_id, logged_at DESC);

CREATE INDEX idx_foods_barcode
  ON foods(barcode)
  WHERE barcode IS NOT NULL;

-- pg_trgm GIN index for fuzzy name search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_foods_name_trgm
  ON foods USING gin (name gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
-- update_updated_at_column() already created by workout migration.

CREATE TRIGGER nutrition_logs_updated_at
  BEFORE UPDATE ON nutrition_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
