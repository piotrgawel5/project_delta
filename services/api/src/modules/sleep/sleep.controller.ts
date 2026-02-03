import { Request, Response } from "express";
import { sleepService } from "./sleep.service";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";

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
        const { user_id } = req.body;
        const requester = (req as any).user;

        if (requester.id !== user_id) {
            throw AppError.forbidden("Unauthorized to save sleep log");
        }

        const data = await sleepService.saveLog(req.body);

        logger.info("Sleep log saved", {
            requestId: req.requestId,
            userId: user_id,
            date: req.body.date,
            source: req.body.source || "unknown",
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
        const { user_id, records } = req.body;
        const requester = (req as any).user;

        if (requester.id !== user_id) {
            throw AppError.forbidden("Unauthorized to sync sleep data");
        }

        const result = await sleepService.syncBatch(user_id, records);

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
     * PATCH /sleep/log/:date/edit
     * Edit an existing sleep log with reason tracking
     */
    async editLog(req: Request, res: Response) {
        const { date } = req.params;
        const { user_id, edit_reason, ...updates } = req.body;
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
            updates,
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
