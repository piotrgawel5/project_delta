import { Router } from "express";
import { sleepController } from "./sleep.controller";
import { requireAuth } from "../auth/auth.middleware";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { sleepHistoryParamsSchema, sleepLogSchema } from "./sleep.validation";
import {
    burstLimiter,
    userReadLimiter,
    userWriteLimiter,
} from "../../middleware/rateLimiter";
import { requireOwnership } from "../../middleware/authorization";

const router = Router();

// Get sleep history for a user
router.get(
    "/:userId/history",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userReadLimiter,
    validate(sleepHistoryParamsSchema),
    asyncHandler((req, res) => sleepController.getHistory(req, res)),
);

// Get sleep log by date
router.get(
    "/:userId/:date",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userReadLimiter,
    asyncHandler((req, res) => sleepController.getLogByDate(req, res)),
);

// Save/update sleep log
router.post(
    "/log",
    requireAuth,
    requireOwnership, // Checks body.user_id matches authenticated user
    burstLimiter,
    userWriteLimiter,
    validate(sleepLogSchema),
    asyncHandler((req, res) => sleepController.saveLog(req, res)),
);

// Delete sleep log
router.delete(
    "/:userId/:date",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userWriteLimiter,
    asyncHandler((req, res) => sleepController.deleteLog(req, res)),
);

export const sleepRoutes = router;
