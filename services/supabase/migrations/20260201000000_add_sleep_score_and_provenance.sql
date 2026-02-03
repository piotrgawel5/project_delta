-- Migration: Add sleep score and provenance fields
-- Version: 20260201000000
-- Description: Adds deterministic scoring, provenance tracking, and edit history
-- to the sleep_data table for production-quality sleep tracking.

-- ============================================================================
-- ADD NEW COLUMNS
-- ============================================================================

-- Deterministic sleep score (0-100)
ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS sleep_score INTEGER;

-- Score breakdown with component scores (deterministic, reproducible)
ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

-- Data source tracking
-- Values: health_connect, digital_wellbeing, usage_stats, wearable, manual
ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'health_connect';

-- Confidence level based on data completeness
-- Values: high, medium, low
ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'medium';

-- Estimated bedtime/wakeup from screen time analysis
ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS estimated_bedtime TIMESTAMPTZ;
ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS estimated_wakeup TIMESTAMPTZ;

-- Screen time summary from native module
ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS screen_time_summary JSONB;

-- Edit history for manual changes
ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS edits JSONB DEFAULT '[]'::jsonb;

-- Session ID for Health Connect correlation
ALTER TABLE sleep_data ADD COLUMN IF NOT EXISTS session_id TEXT;

-- ============================================================================
-- ADD CONSTRAINTS
-- ============================================================================

-- Sleep score must be 0-100
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sleep_score_range'
    ) THEN
        ALTER TABLE sleep_data ADD CONSTRAINT sleep_score_range 
            CHECK (sleep_score IS NULL OR (sleep_score >= 0 AND sleep_score <= 100));
    END IF;
END $$;

-- Source must be one of the allowed values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'source_valid'
    ) THEN
        ALTER TABLE sleep_data ADD CONSTRAINT source_valid 
            CHECK (source IS NULL OR source IN ('health_connect', 'digital_wellbeing', 'usage_stats', 'wearable', 'manual'));
    END IF;
END $$;

-- Confidence must be one of the allowed values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'confidence_valid'
    ) THEN
        ALTER TABLE sleep_data ADD CONSTRAINT confidence_valid 
            CHECK (confidence IS NULL OR confidence IN ('high', 'medium', 'low'));
    END IF;
END $$;

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_sleep_data_source ON sleep_data(source);

-- Composite index for efficient user+date queries
CREATE INDEX IF NOT EXISTS idx_sleep_data_user_date ON sleep_data(user_id, date DESC);

-- Index for finding unsynced records
CREATE INDEX IF NOT EXISTS idx_sleep_data_synced_at ON sleep_data(synced_at) WHERE synced_at IS NULL;

-- ============================================================================
-- BACKFILL EXISTING RECORDS
-- ============================================================================

-- Set default source and confidence for existing records
UPDATE sleep_data 
SET 
    source = COALESCE(source, 
        CASE 
            WHEN data_source = 'manual_entry' THEN 'manual'
            ELSE 'health_connect'
        END),
    confidence = COALESCE(confidence, 
        CASE 
            WHEN data_source = 'manual_entry' THEN 'low'
            ELSE 'medium'
        END)
WHERE source IS NULL OR confidence IS NULL;

-- Initialize empty edits array for existing records
UPDATE sleep_data 
SET edits = '[]'::jsonb 
WHERE edits IS NULL;

-- ============================================================================
-- ADD UPDATED_AT TRIGGER (if not exists)
-- ============================================================================

-- Create or replace updated_at function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_sleep_data'
    ) THEN
        CREATE TRIGGER set_updated_at_sleep_data
            BEFORE UPDATE ON sleep_data
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN sleep_data.sleep_score IS 'Deterministic sleep score (0-100) calculated from duration, stages, efficiency, and consistency';
COMMENT ON COLUMN sleep_data.score_breakdown IS 'JSON object with component scores: duration_norm (0-35), deep_pct (0-20), rem_pct (0-20), efficiency (0-15), consistency (0-10)';
COMMENT ON COLUMN sleep_data.source IS 'Data source: health_connect, digital_wellbeing, usage_stats, wearable, manual';
COMMENT ON COLUMN sleep_data.confidence IS 'Confidence level based on data completeness: high, medium, low';
COMMENT ON COLUMN sleep_data.estimated_bedtime IS 'Estimated bedtime from screen time analysis (when no Health Connect data)';
COMMENT ON COLUMN sleep_data.estimated_wakeup IS 'Estimated wakeup time from screen time analysis (when no Health Connect data)';
COMMENT ON COLUMN sleep_data.screen_time_summary IS 'JSON object with screen time data used for estimation';
COMMENT ON COLUMN sleep_data.edits IS 'JSON array of edit records with timestamps, reasons, and previous values';
