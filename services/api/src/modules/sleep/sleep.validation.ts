import { z } from "zod";

// ============================================================================
// SHARED TYPES
// ============================================================================

/**
 * Data source enum - ordered by reliability
 */
export const dataSourceSchema = z.enum([
    "health_connect",
    "digital_wellbeing",
    "usage_stats",
    "wearable",
    "manual",
]);

/**
 * Confidence level based on data completeness and source
 */
export const confidenceSchema = z.enum(["high", "medium", "low"]);

/**
 * Score breakdown schema - deterministic scoring components
 */
export const scoreBreakdownSchema = z.object({
    duration_norm: z.number().min(0).max(35),
    deep_pct: z.number().min(0).max(20),
    rem_pct: z.number().min(0).max(20),
    efficiency: z.number().min(0).max(15),
    consistency: z.number().min(0).max(10),
    total: z.number().min(0).max(100),
});

/**
 * Screen time summary schema
 */
export const screenTimeSummarySchema = z.object({
    total_minutes: z.number().int().min(0).optional(),
    last_unlock_before_bedtime: z.string().nullable().optional(),
    first_unlock_after_wakeup: z.string().nullable().optional(),
    provenance: z.enum(["usage_stats", "digital_wellbeing", "estimated"])
        .optional(),
});

/**
 * Edit record schema for tracking manual changes
 */
export const sleepEditSchema = z.object({
    edited_at: z.string(),
    edited_by: z.string(),
    edit_reason: z.string().min(1).max(200),
    prev_record: z.record(z.unknown()).optional(),
});

// ============================================================================
// MAIN SCHEMAS
// ============================================================================

export const sleepLogSchema = z.object({
    body: z.object({
        // Identifiers
        user_id: z.string().uuid(),
        session_id: z.string().optional(),
        date: z.string().regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format",
        ),

        // Core sleep data
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        duration_minutes: z.number().int().min(0).max(1440).optional(),
        quality_score: z.number().min(0).max(100).optional(),

        // Individual sleep stage durations (from Health Connect)
        deep_sleep_minutes: z.number().int().min(0).optional(),
        rem_sleep_minutes: z.number().int().min(0).optional(),
        light_sleep_minutes: z.number().int().min(0).optional(),
        awake_minutes: z.number().int().min(0).optional(),

        // NEW: Deterministic scoring
        sleep_score: z.number().int().min(0).max(100).optional(),
        score_breakdown: scoreBreakdownSchema.optional(),

        // NEW: Provenance tracking
        source: dataSourceSchema.optional(),
        confidence: confidenceSchema.optional(),

        // NEW: Estimation data
        estimated_bedtime: z.string().optional(),
        estimated_wakeup: z.string().optional(),
        screen_time_summary: screenTimeSummarySchema.optional(),

        // NEW: Edit history
        edits: z.array(sleepEditSchema).optional(),

        // Legacy source and sync metadata
        data_source: z.string().optional(),
        synced_at: z.string().optional(),

        // Optional fields
        heart_rate_avg: z.number().int().min(20).max(200).optional(),
        notes: z.string().max(500).optional(),
    }),
});

/**
 * Batch sync schema for multiple records
 */
export const sleepBatchSyncSchema = z.object({
    body: z.object({
        user_id: z.string().uuid(),
        records: z.array(sleepLogSchema.shape.body.omit({ user_id: true })).min(
            1,
        ).max(30),
    }),
});

/**
 * Edit request schema
 */
export const sleepEditRequestSchema = z.object({
    body: z.object({
        user_id: z.string().uuid(),
        edit_reason: z.string().min(1).max(200),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        notes: z.string().max(500).optional(),
    }),
    params: z.object({
        date: z.string().regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format",
        ),
    }),
});

/**
 * Sleep history params schema
 */
export const sleepHistoryParamsSchema = z.object({
    params: z.object({
        userId: z.string().uuid(),
    }),
    query: z.object({
        // Date range filters
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        // Pagination
        limit: z.coerce.number().int().min(1).max(90).default(30).optional(),
        offset: z.coerce.number().int().min(0).default(0).optional(),
    }).optional(),
});

/**
 * Get log by date schema with include options
 */
export const sleepLogByDateSchema = z.object({
    params: z.object({
        userId: z.string().uuid(),
        date: z.string().regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format",
        ),
    }),
    query: z.object({
        // Comma-separated includes: stages,metrics,screen_time,provenance,edits
        include: z.string().optional(),
    }).optional(),
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type SleepLog = z.infer<typeof sleepLogSchema>["body"];
export type SleepBatchSync = z.infer<typeof sleepBatchSyncSchema>["body"];
export type SleepEditRequest = z.infer<typeof sleepEditRequestSchema>;
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;
export type DataSource = z.infer<typeof dataSourceSchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type SleepEdit = z.infer<typeof sleepEditSchema>;
