-- Rollback: Remove sleep score and provenance fields
-- Version: 20260201000000
-- Run this to revert the migration if needed

-- ============================================================================
-- DROP TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS set_updated_at_sleep_data ON sleep_data;

-- ============================================================================
-- DROP INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_sleep_data_source;
DROP INDEX IF EXISTS idx_sleep_data_user_date;
DROP INDEX IF EXISTS idx_sleep_data_synced_at;

-- ============================================================================
-- DROP CONSTRAINTS
-- ============================================================================

ALTER TABLE sleep_data DROP CONSTRAINT IF EXISTS sleep_score_range;
ALTER TABLE sleep_data DROP CONSTRAINT IF EXISTS source_valid;
ALTER TABLE sleep_data DROP CONSTRAINT IF EXISTS confidence_valid;

-- ============================================================================
-- DROP COLUMNS
-- ============================================================================

ALTER TABLE sleep_data DROP COLUMN IF EXISTS sleep_score;
ALTER TABLE sleep_data DROP COLUMN IF EXISTS score_breakdown;
ALTER TABLE sleep_data DROP COLUMN IF EXISTS source;
ALTER TABLE sleep_data DROP COLUMN IF EXISTS confidence;
ALTER TABLE sleep_data DROP COLUMN IF EXISTS estimated_bedtime;
ALTER TABLE sleep_data DROP COLUMN IF EXISTS estimated_wakeup;
ALTER TABLE sleep_data DROP COLUMN IF EXISTS screen_time_summary;
ALTER TABLE sleep_data DROP COLUMN IF EXISTS edits;
ALTER TABLE sleep_data DROP COLUMN IF EXISTS session_id;

-- Note: The updated_at function is kept as it may be used by other tables
