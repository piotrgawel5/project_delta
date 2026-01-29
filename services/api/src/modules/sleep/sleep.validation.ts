import { z } from "zod";

export const sleepLogSchema = z.object({
    body: z.object({
        user_id: z.string().uuid(),
        date: z.string().regex(
            /^\d{4}-\d{2}-\d{2}$/,
            "Date must be in YYYY-MM-DD format",
        ),
        start_time: z.string().optional(),
        end_time: z.string().optional(),
        duration_minutes: z.number().int().min(0).max(1440).optional(),
        quality_score: z.number().min(0).max(100).optional(),
        // Individual sleep stage durations (from Health Connect)
        deep_sleep_minutes: z.number().int().min(0).optional(),
        rem_sleep_minutes: z.number().int().min(0).optional(),
        light_sleep_minutes: z.number().int().min(0).optional(),
        awake_minutes: z.number().int().min(0).optional(),
        // Source and sync metadata
        data_source: z.string().optional(),
        synced_at: z.string().optional(),
        // Optional fields
        heart_rate_avg: z.number().int().min(20).max(200).optional(),
        notes: z.string().max(500).optional(),
    }),
});

export const sleepHistoryParamsSchema = z.object({
    params: z.object({
        userId: z.string().uuid(),
    }),
});

export type SleepLog = z.infer<typeof sleepLogSchema>["body"];
