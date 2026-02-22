import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { AppError } from "../../utils/AppError";
import {
    ScoreBreakdown,
    SleepBatchSync,
    SleepEdit,
    SleepLog,
} from "./sleep.validation";

// ============================================================================
// TYPES
// ============================================================================

interface SleepDataRow {
    id: string;
    user_id: string;
    date: string;
    start_time?: string;
    end_time?: string;
    duration_minutes?: number;
    quality_score?: number;
    deep_sleep_minutes?: number;
    rem_sleep_minutes?: number;
    light_sleep_minutes?: number;
    awake_minutes?: number;
    sleep_score?: number;
    score_breakdown?: ScoreBreakdown;
    source?: string;
    confidence?: string;
    estimated_bedtime?: string;
    estimated_wakeup?: string;
    screen_time_summary?: Record<string, unknown>;
    edits?: SleepEdit[];
    data_source?: string;
    synced_at?: string;
    heart_rate_avg?: number;
    notes?: string;
    created_at: string;
    updated_at: string;
}

interface SleepPhaseTimelineRow {
    id: string;
    sleep_data_id: string;
    user_id: string;
    cycle_number: number;
    stage: "awake" | "light" | "deep" | "rem";
    start_time: string;
    end_time: string;
    duration_minutes: number;
    confidence: "high" | "medium" | "low";
    generation_v: number;
    created_at: string;
}

interface GetLogByDateOptions {
    include?: string[];
}

// ============================================================================
// SERVICE
// ============================================================================

export class SleepService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(
            config.supabase.url!,
            config.supabase.serviceRoleKey!,
        );
    }

    /**
     * Get sleep history for a user with optional date range
     */
    async getHistory(
        userId: string,
        options: {
            limit?: number;
            offset?: number;
            startDate?: string;
            endDate?: string;
        } = {},
    ): Promise<SleepDataRow[]> {
        const { limit = 30, offset = 0, startDate, endDate } = options;

        let query = this.supabase
            .from("sleep_data")
            .select("*")
            .eq("user_id", userId)
            .order("date", { ascending: false })
            .range(offset, offset + limit - 1);

        if (startDate) {
            query = query.gte("date", startDate);
        }
        if (endDate) {
            query = query.lte("date", endDate);
        }

        const { data, error } = await query;

        if (error) {
            throw AppError.internal(
                `Failed to fetch sleep history: ${error.message}`,
            );
        }

        return data || [];
    }

    /**
     * Save or update a sleep log (upsert on user_id + date)
     */
    async saveLog(sleepLog: SleepLog): Promise<SleepDataRow> {
        const { data, error } = await this.supabase
            .from("sleep_data")
            .upsert(sleepLog, { onConflict: "user_id,date" })
            .select()
            .single();

        if (error) {
            throw AppError.internal(
                `Failed to save sleep log: ${error.message}`,
            );
        }

        return data;
    }

    /**
     * Batch sync multiple sleep records
     */
    async syncBatch(
        userId: string,
        records: SleepBatchSync["records"],
    ): Promise<{
        synced: number;
        failed: number;
        errors: Array<{ date: string; error: string }>;
    }> {
        const results = {
            synced: 0,
            failed: 0,
            errors: [] as Array<{ date: string; error: string }>,
        };

        // Prepare records with user_id
        const recordsWithUserId = records.map((r) => ({
            ...r,
            user_id: userId,
            synced_at: new Date().toISOString(),
        }));

        // Upsert in batch
        const { data, error } = await this.supabase
            .from("sleep_data")
            .upsert(recordsWithUserId, {
                onConflict: "user_id,date",
                ignoreDuplicates: false,
            })
            .select();

        if (error) {
            // If batch fails, try individual inserts
            for (const record of recordsWithUserId) {
                try {
                    await this.saveLog(record);
                    results.synced++;
                } catch (err) {
                    results.failed++;
                    results.errors.push({
                        date: record.date,
                        error: err instanceof Error
                            ? err.message
                            : "Unknown error",
                    });
                }
            }
        } else {
            results.synced = data?.length || 0;
        }

        return results;
    }

    /**
     * Get a specific sleep log by date with optional includes
     */
    async getLogByDate(
        userId: string,
        date: string,
        options: GetLogByDateOptions = {},
    ): Promise<SleepDataRow | null> {
        const { include = [] } = options;

        // Build select statement based on includes
        let selectFields = "*";
        if (include.length > 0) {
            const baseFields = [
                "id",
                "user_id",
                "date",
                "start_time",
                "end_time",
                "duration_minutes",
                "quality_score",
                "sleep_score",
                "data_source",
                "synced_at",
                "created_at",
                "updated_at",
            ];

            const includeMap: Record<string, string[]> = {
                stages: [
                    "deep_sleep_minutes",
                    "rem_sleep_minutes",
                    "light_sleep_minutes",
                    "awake_minutes",
                ],
                metrics: ["sleep_score", "score_breakdown", "heart_rate_avg"],
                screen_time: [
                    "screen_time_summary",
                    "estimated_bedtime",
                    "estimated_wakeup",
                ],
                provenance: ["source", "confidence"],
                edits: ["edits", "notes"],
            };

            const selectedFields = new Set(baseFields);
            for (const inc of include) {
                const fields = includeMap[inc];
                if (fields) {
                    fields.forEach((f) => selectedFields.add(f));
                }
            }
            selectFields = Array.from(selectedFields).join(",");
        }

        const { data, error } = await this.supabase
            .from("sleep_data")
            .select(selectFields)
            .eq("user_id", userId)
            .eq("date", date)
            .single();

        if (error && error.code !== "PGRST116") {
            throw AppError.internal(
                `Failed to fetch sleep log: ${error.message}`,
            );
        }

        return (data as unknown as SleepDataRow) || null;
    }

    /**
     * Get sleep phase timeline for a specific sleep session by (userId, date)
     * Joins through sleep_data to resolve date  sleep_data_id
     */
    async getTimeline(
        userId: string,
        date: string,
    ): Promise<{ phases: SleepPhaseTimelineRow[]; sleepDataId: string | null }> {
        // Step 1: find the sleep_data id for this user + date
        const { data: sleepRecord, error: sleepError } = await this.supabase
            .from("sleep_data")
            .select("id")
            .eq("user_id", userId)
            .eq("date", date)
            .single();

        if (sleepError || !sleepRecord) {
            return { phases: [], sleepDataId: null };
        }

        // Step 2: fetch timeline phases for that sleep_data_id
        const { data, error } = await this.supabase
            .from("sleep_phase_timeline")
            .select(
                "id, sleep_data_id, user_id, cycle_number, stage, " +
                    "start_time, end_time, duration_minutes, confidence, generation_v, created_at",
            )
            .eq("sleep_data_id", sleepRecord.id)
            .eq("user_id", userId)
            .order("start_time", { ascending: true });

        if (error) {
            throw AppError.internal(
                `Failed to fetch sleep timeline: ${error.message}`,
            );
        }

        return {
            phases: ((data ?? []) as unknown) as SleepPhaseTimelineRow[],
            sleepDataId: sleepRecord.id,
        };
    }

    /**
     * Edit an existing sleep log with reason tracking
     */
    async editLog(
        userId: string,
        date: string,
        editReason: string,
        updates: Partial<SleepLog>,
    ): Promise<SleepDataRow> {
        // First, get the existing record
        const existing = await this.getLogByDate(userId, date, {
            include: ["edits"],
        });

        if (!existing) {
            throw AppError.notFound(`Sleep log not found for date: ${date}`);
        }

        // Create edit record
        const editRecord: SleepEdit = {
            edited_at: new Date().toISOString(),
            edited_by: userId,
            edit_reason: editReason,
            prev_record: {
                start_time: existing.start_time,
                end_time: existing.end_time,
                duration_minutes: existing.duration_minutes,
                sleep_score: existing.sleep_score,
            },
        };

        // Append to existing edits (max 10)
        const existingEdits = existing.edits || [];
        const edits = [...existingEdits, editRecord].slice(-10);

        // Update the record
        const { data, error } = await this.supabase
            .from("sleep_data")
            .update({
                ...updates,
                edits,
                source: "manual", // Mark as manual after edit
                confidence: "low",
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId)
            .eq("date", date)
            .select()
            .single();

        if (error) {
            throw AppError.internal(
                `Failed to edit sleep log: ${error.message}`,
            );
        }

        return data;
    }

    /**
     * Delete a sleep log
     */
    async deleteLog(userId: string, date: string): Promise<boolean> {
        const { error } = await this.supabase
            .from("sleep_data")
            .delete()
            .eq("user_id", userId)
            .eq("date", date);

        if (error) {
            throw AppError.internal(
                `Failed to delete sleep log: ${error.message}`,
            );
        }

        return true;
    }

    /**
     * Purge all sleep data for a user (for account deletion)
     */
    async purgeAllUserData(userId: string): Promise<number> {
        // First count records
        const { count } = await this.supabase
            .from("sleep_data")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        // Then delete
        const { error } = await this.supabase
            .from("sleep_data")
            .delete()
            .eq("user_id", userId);

        if (error) {
            throw AppError.internal(
                `Failed to purge user sleep data: ${error.message}`,
            );
        }

        return count || 0;
    }
}

export const sleepService = new SleepService();
