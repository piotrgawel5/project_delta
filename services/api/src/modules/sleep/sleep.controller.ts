import { Request, Response } from "express";
import { sleepService } from "./sleep.service";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";

export class SleepController {
    async getHistory(req: Request, res: Response) {
        const { userId } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized access to sleep data");
        }

        const limit = req.query.limit
            ? parseInt(req.query.limit as string, 10)
            : 30;
        const data = await sleepService.getHistory(userId, limit);

        res.json({
            success: true,
            data,
        });
    }

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
        });

        res.json({
            success: true,
            data,
        });
    }

    async getLogByDate(req: Request, res: Response) {
        const { userId, date } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized access to sleep data");
        }

        const data = await sleepService.getLogByDate(userId, date);

        if (!data) {
            throw AppError.notFound("Sleep log not found");
        }

        res.json({
            success: true,
            data,
        });
    }

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
}

export const sleepController = new SleepController();
