import { Request, Response } from "express";
import { sleepService } from "./sleep.service";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { SleepLog } from "./sleep.validation";

type SleepRequestBody = Record<string, unknown>;

function cleanUndefined<T extends Record<string, unknown>>(obj: T): T {
    return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => value !== undefined),
    ) as T;
}

function normalizeSleepLogBody(body: SleepRequestBody): SleepLog {
    const screenTimeSummary = (body.screen_time_summary ||
        body.screenTimeSummary) as Record<string, unknown> | undefined;

    const editsRaw = Array.isArray(body.edits) ? body.edits : undefined;
    const edits = editsRaw?.map((edit) => {
        const e = edit as Record<string, unknown>;
        return cleanUndefined({
            edited_at: e.edited_at as string | undefined,
            edited_by: e.edited_by as string | undefined,
            edit_reason: e.edit_reason as string | undefined,
            prev_record: (e.prev_record || e.prev_values) as
                | Record<string, unknown>
                | undefined,
        });
    });

    const normalized = cleanUndefined({
        user_id: (body.user_id || body.userId) as string | undefined,
        session_id: (body.session_id || body.sessionId) as string | undefined,
        date: body.date as string,
        start_time: (body.start_time ?? body.startTime) as string | undefined,
        end_time: (body.end_time ?? body.endTime) as string | undefined,
        duration_minutes: (body.duration_minutes ??
            body.durationMinutes) as number | undefined,
        quality_score: (body.quality_score ??
            body.qualityScore) as number | undefined,
        deep_sleep_minutes: (body.deep_sleep_minutes ??
            body.deepSleepMinutes) as number | undefined,
        rem_sleep_minutes: (body.rem_sleep_minutes ??
            body.remSleepMinutes) as number | undefined,
        light_sleep_minutes: (body.light_sleep_minutes ??
            body.lightSleepMinutes) as number | undefined,
        awake_minutes: (body.awake_minutes ??
            body.awakeSleepMinutes) as number | undefined,
        sleep_score: (body.sleep_score ?? body.sleepScore) as number | undefined,
        score_breakdown: (body.score_breakdown ??
            body.scoreBreakdown) as SleepLog["score_breakdown"],
        source: body.source as SleepLog["source"] | undefined,
        confidence: body.confidence as SleepLog["confidence"] | undefined,
        estimated_bedtime: (body.estimated_bedtime ??
            body.estimatedBedtime) as string | undefined,
        estimated_wakeup: (body.estimated_wakeup ??
            body.estimatedWakeup) as string | undefined,
        screen_time_summary: screenTimeSummary
            ? cleanUndefined({
                total_minutes: (screenTimeSummary.total_minutes ??
                    screenTimeSummary.totalMinutesLast2Hours) as
                    | number
                    | undefined,
                last_unlock_before_bedtime: screenTimeSummary
                    .last_unlock_before_bedtime as string | null | undefined,
                first_unlock_after_wakeup: screenTimeSummary
                    .first_unlock_after_wakeup as string | null | undefined,
                provenance: screenTimeSummary.provenance as
                    | "usage_stats"
                    | "digital_wellbeing"
                    | "estimated"
                    | undefined,
            })
            : undefined,
        edits: edits as SleepLog["edits"] | undefined,
        data_source: (body.data_source ?? body.dataSource) as
            | string
            | undefined,
        synced_at: (body.synced_at ?? body.syncedAt) as string | undefined,
        heart_rate_avg: (body.heart_rate_avg ??
            body.heartRateAvg) as number | undefined,
        notes: body.notes as string | undefined,
    });

    return normalized as SleepLog;
}

export class SleepController {
    /**
     * GET /sleep/:userId/history
     * Get sleep history with optional date range and pagination
     */
    async getHistory(req: Request, res: Response) {
        const { userId } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized access to sleep data");
        }

        const limit = req.query.limit
            ? parseInt(req.query.limit as string, 10)
            : 30;
        const offset = req.query.offset
            ? parseInt(req.query.offset as string, 10)
            : 0;
        const startDate = req.query.start_date as string | undefined;
        const endDate = req.query.end_date as string | undefined;

        const data = await sleepService.getHistory(userId, {
            limit,
            offset,
            startDate,
            endDate,
        });

        res.json({
            success: true,
            data,
            pagination: {
                limit,
                offset,
                count: data.length,
            },
        });
    }

    /**
     * POST /sleep/log
     * Save or update a single sleep log
     */
    async saveLog(req: Request, res: Response) {
        const sleepLog = normalizeSleepLogBody(req.body as SleepRequestBody);
        const { user_id } = sleepLog;
        const requester = (req as any).user;

        if (requester.id !== user_id) {
            throw AppError.forbidden("Unauthorized to save sleep log");
        }

        const data = await sleepService.saveLog(sleepLog);

        logger.info("Sleep log saved", {
            requestId: req.requestId,
            userId: user_id,
            date: sleepLog.date,
            source: sleepLog.source || "unknown",
        });

        res.json({
            success: true,
            data,
        });
    }

    /**
     * POST /sleep/sync-batch
     * Batch sync multiple sleep records
     */
    async syncBatch(req: Request, res: Response) {
        const user_id = (req.body.user_id || req.body.userId) as string;
        const records = Array.isArray(req.body.records) ? req.body.records : [];
        const requester = (req as any).user;

        if (requester.id !== user_id) {
            throw AppError.forbidden("Unauthorized to sync sleep data");
        }

        const normalizedRecords = records.map((record: unknown) =>
            normalizeSleepLogBody({
                ...(record as Record<string, unknown>),
                user_id,
            })
        );

        const result = await sleepService.syncBatch(user_id, normalizedRecords);

        logger.info("Sleep batch sync completed", {
            requestId: req.requestId,
            userId: user_id,
            synced: result.synced,
            failed: result.failed,
        });

        res.json({
            success: true,
            data: result,
        });
    }

    /**
     * GET /sleep/:userId/log/:date
     * Get a specific sleep log by date with optional includes
     */
    async getLogByDate(req: Request, res: Response) {
        const { userId, date } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized access to sleep data");
        }

        // Parse include query param (comma-separated)
        const includeParam = req.query.include as string | undefined;
        const include = includeParam
            ? includeParam.split(",").map((s) => s.trim())
            : [];

        const data = await sleepService.getLogByDate(userId, date, { include });

        if (!data) {
            throw AppError.notFound("Sleep log not found");
        }

        res.json({
            success: true,
            data,
        });
    }

    /**
     * GET /sleep/:userId/timeline/:date
     * Returns the sleep phase timeline for a specific night (premium feature)
     */
    async getTimeline(req: Request, res: Response) {
        const { userId, date } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized access to sleep timeline");
        }

        const { phases, sleepDataId } = await sleepService.getTimeline(
            userId,
            date,
        );

        res.json({
            success: true,
            data: {
                sleep_data_id: sleepDataId,
                date,
                phases,
                meta: {
                    total_phases: phases.length,
                    estimated_cycles: phases.length > 0
                        ? Math.max(...phases.map((p) => p.cycle_number))
                        : 0,
                    confidence: phases[0]?.confidence ?? null,
                    generation_v: phases[0]?.generation_v ?? null,
                },
            },
        });
    }

    /**
     * PATCH /sleep/log/:date/edit
     * Edit an existing sleep log with reason tracking
     */
    async editLog(req: Request, res: Response) {
        const { date } = req.params;
        const user_id = (req.body.user_id || req.body.userId) as string;
        const edit_reason = (req.body.edit_reason || req.body.editReason) as
            | string
            | undefined;
        const updates = normalizeSleepLogBody({
            ...req.body,
            user_id,
            date,
        });
        const requester = (req as any).user;

        if (requester.id !== user_id) {
            throw AppError.forbidden("Unauthorized to edit sleep log");
        }

        if (!edit_reason) {
            throw AppError.badRequest("Edit reason is required");
        }

        const data = await sleepService.editLog(
            user_id,
            date,
            edit_reason,
            cleanUndefined({
                ...updates,
                user_id: undefined,
                date: undefined,
            }),
        );

        logger.info("Sleep log edited", {
            requestId: req.requestId,
            userId: user_id,
            date,
            editReason: edit_reason,
        });

        res.json({
            success: true,
            data,
        });
    }

    /**
     * DELETE /sleep/:userId/log/:date
     * Delete a sleep log
     */
    async deleteLog(req: Request, res: Response) {
        const { userId, date } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized to delete sleep log");
        }

        await sleepService.deleteLog(userId, date);

        logger.info("Sleep log deleted", {
            requestId: req.requestId,
            userId,
            date,
        });

        res.json({
            success: true,
            message: "Sleep log deleted successfully",
        });
    }

    /**
     * DELETE /user/:id/data
     * Purge all sleep data for a user (account deletion)
     */
    async purgeUserData(req: Request, res: Response) {
        const { id: userId } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized to purge user data");
        }

        const deletedCount = await sleepService.purgeAllUserData(userId);

        logger.info("User sleep data purged", {
            requestId: req.requestId,
            userId,
            deletedRecords: deletedCount,
        });

        res.json({
            success: true,
            message: `Purged ${deletedCount} sleep records`,
            deleted_count: deletedCount,
        });
    }
}

export const sleepController = new SleepController();
