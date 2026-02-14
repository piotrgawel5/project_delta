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
export const legacyScoreBreakdownSchema = z.object({
    duration_norm: z.number().min(0).max(35),
    deep_pct: z.number().min(0).max(20),
    rem_pct: z.number().min(0).max(20),
    efficiency: z.number().min(0).max(15),
    consistency: z.number().min(0).max(10),
    total: z.number().min(0).max(100),
});

const componentResultSchema = z.object({
    raw: z.number(),
    norm: z.number(),
    normalised: z.number(),
    weight: z.number(),
    contribution: z.number(),
});

const richScoreBreakdownSchema = z.object({
    score: z.number().min(0).max(100),
    confidence: confidenceSchema,
    components: z.object({
        duration: componentResultSchema,
        deepSleep: componentResultSchema,
        remSleep: componentResultSchema,
        efficiency: componentResultSchema,
        waso: componentResultSchema,
        consistency: componentResultSchema,
        timing: componentResultSchema,
        screenTime: componentResultSchema,
    }),
    weights: z.object({
        duration: z.number(),
        deepSleep: z.number(),
        remSleep: z.number(),
        efficiency: z.number(),
        waso: z.number(),
        consistency: z.number(),
        timing: z.number(),
        screenTime: z.number(),
    }),
    adjustments: z.object({
        sourceReliabilityFactor: z.number(),
        dataCompletenessFactor: z.number(),
        chronicDebtPenalty: z.number(),
        ageEfficiencyCorrection: z.number(),
        chronotypeAlignmentDelta: z.number(),
    }),
    baseline: z.object({
        avgDurationMin: z.number(),
        avgDeepPct: z.number(),
        avgRemPct: z.number(),
        avgEfficiency: z.number(),
        avgWasoMin: z.number(),
        medianBedtimeMinutesFromMidnight: z.number(),
        medianWakeMinutesFromMidnight: z.number(),
        bedtimeVarianceMinutes: z.number(),
        p25DurationMin: z.number(),
        p75DurationMin: z.number(),
        nightsAnalysed: z.number(),
    }),
    ageNorm: z.object({
        idealDurationMin: z.number(),
        minHealthyDurationMin: z.number(),
        deepPctIdeal: z.number(),
        deepPctLow: z.number(),
        deepPctHigh: z.number(),
        remPctIdeal: z.number(),
        remPctLow: z.number(),
        remPctHigh: z.number(),
        efficiencyIdeal: z.number(),
        efficiencyLow: z.number(),
        wasoExpected: z.number(),
        wasoAcceptable: z.number(),
    }),
    flags: z.array(z.string()),
    calculatedAt: z.string(),
});

export const scoreBreakdownSchema = z.union([
    legacyScoreBreakdownSchema,
    richScoreBreakdownSchema,
]);

/**
 * Screen time summary schema
 */
export const screenTimeSummarySchema = z.object({
    total_minutes: z.number().int().min(0).optional(),
    last_unlock_before_bedtime: z.string().nullable().optional(),
    first_unlock_after_wakeup: z.string().nullable().optional(),
    provenance: z.enum(["usage_stats", "digital_wellbeing", "estimated"])
        .optional(),
}).or(z.object({
    totalMinutesLast2Hours: z.number().int().min(0).optional(),
    blueLight: z.boolean().optional(),
    lastAppUsedMinutesBeforeBed: z.number().int().min(0).optional(),
}));

/**
 * Edit record schema for tracking manual changes
 */
export const sleepEditSchema = z.object({
    edited_at: z.string(),
    edited_by: z.string(),
    edit_reason: z.string().min(1).max(200),
    prev_record: z.record(z.unknown()).optional(),
    prev_values: z.record(z.unknown()).optional(),
});

// ============================================================================
// MAIN SCHEMAS
// ============================================================================

const sleepLogBodySchema = z.object({
        // Identifiers
        user_id: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        session_id: z.string().optional(),
        sessionId: z.string().optional(),
        date: z.string().regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format",
        ),

        // Core sleep data
        start_time: z.string().optional(),
        startTime: z.string().optional(),
        end_time: z.string().optional(),
        endTime: z.string().optional(),
        duration_minutes: z.number().int().min(0).max(1440).optional(),
        durationMinutes: z.number().int().min(0).max(1440).optional(),
        quality_score: z.number().min(0).max(100).optional(),
        qualityScore: z.number().min(0).max(100).optional(),

        // Individual sleep stage durations (from Health Connect)
        deep_sleep_minutes: z.number().int().min(0).optional(),
        deepSleepMinutes: z.number().int().min(0).optional(),
        rem_sleep_minutes: z.number().int().min(0).optional(),
        remSleepMinutes: z.number().int().min(0).optional(),
        light_sleep_minutes: z.number().int().min(0).optional(),
        lightSleepMinutes: z.number().int().min(0).optional(),
        awake_minutes: z.number().int().min(0).optional(),
        awakeSleepMinutes: z.number().int().min(0).optional(),

        // NEW: Deterministic scoring
        sleep_score: z.number().int().min(0).max(100).optional(),
        sleepScore: z.number().int().min(0).max(100).optional(),
        score_breakdown: scoreBreakdownSchema.optional(),
        scoreBreakdown: scoreBreakdownSchema.optional(),

        // NEW: Provenance tracking
        source: dataSourceSchema.optional(),
        confidence: confidenceSchema.optional(),

        // NEW: Estimation data
        estimated_bedtime: z.string().optional(),
        estimatedBedtime: z.string().optional(),
        estimated_wakeup: z.string().optional(),
        estimatedWakeup: z.string().optional(),
        screen_time_summary: screenTimeSummarySchema.optional(),
        screenTimeSummary: screenTimeSummarySchema.optional(),

        // NEW: Edit history
        edits: z.array(sleepEditSchema).optional(),

        // Legacy source and sync metadata
        data_source: z.string().optional(),
        dataSource: z.string().optional(),
        synced_at: z.string().optional(),
        syncedAt: z.string().optional(),

        // Optional fields
        heart_rate_avg: z.number().int().min(20).max(200).optional(),
        heartRateAvg: z.number().int().min(20).max(200).optional(),
        notes: z.string().max(500).optional(),
});

export const sleepLogSchema = z.object({
    body: sleepLogBodySchema.superRefine((body, ctx) => {
        if (!body.user_id && !body.userId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["user_id"],
                message: "user_id or userId is required",
            });
        }
    }),
});

/**
 * Batch sync schema for multiple records
 */
export const sleepBatchSyncSchema = z.object({
    body: z.object({
        user_id: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        records: z.array(
            sleepLogBodySchema.omit({ user_id: true, userId: true }),
        ).min(
            1,
        ).max(30),
    }).superRefine((body, ctx) => {
        if (!body.user_id && !body.userId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["user_id"],
                message: "user_id or userId is required",
            });
        }
    }),
});

/**
 * Edit request schema
 */
export const sleepEditRequestSchema = z.object({
    body: z.object({
        user_id: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        edit_reason: z.string().min(1).max(200).optional(),
        editReason: z.string().min(1).max(200).optional(),
        start_time: z.string().optional(),
        startTime: z.string().optional(),
        end_time: z.string().optional(),
        endTime: z.string().optional(),
        notes: z.string().max(500).optional(),
    }).superRefine((body, ctx) => {
        if (!body.user_id && !body.userId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["user_id"],
                message: "user_id or userId is required",
            });
        }
        if (!body.edit_reason && !body.editReason) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["edit_reason"],
                message: "edit_reason or editReason is required",
            });
        }
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
