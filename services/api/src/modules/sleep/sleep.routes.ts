import { Router } from "express";
import { sleepController } from "./sleep.controller";
import { requireAuth } from "../auth/auth.middleware";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
    sleepBatchSyncSchema,
    sleepEditRequestSchema,
    sleepHistoryParamsSchema,
    sleepLogByDateSchema,
    sleepLogSchema,
    sleepTimelineParamsSchema,
} from "./sleep.validation";
import {
    burstLimiter,
    userReadLimiter,
    userWriteLimiter,
} from "../../middleware/rateLimiter";
import { requireOwnership } from "../../middleware/authorization";

const router = Router();

// ============================================================================
// READ ENDPOINTS
// ============================================================================

/**
 * GET /sleep/:userId/history
 * Get sleep history with optional date range and pagination
 * Query params: ?limit=30&offset=0&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
 */
router.get(
    "/:userId/history",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userReadLimiter,
    validate(sleepHistoryParamsSchema),
    asyncHandler((req, res) => sleepController.getHistory(req, res)),
);

/**
 * GET /sleep/:userId/log/:date
 * Get sleep log by date with optional includes
 * Query params: ?include=stages,metrics,screen_time,provenance,edits
 */
router.get(
    "/:userId/log/:date",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userReadLimiter,
    validate(sleepLogByDateSchema),
    asyncHandler((req, res) => sleepController.getLogByDate(req, res)),
);

/**
 * GET /sleep/:userId/timeline/:date
 * Get sleep phase timeline for a specific night (premium feature)
 */
router.get(
    "/:userId/timeline/:date",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userReadLimiter,
    validate(sleepTimelineParamsSchema),
    asyncHandler((req, res) => sleepController.getTimeline(req, res)),
);

// Legacy route - redirect to new pattern
router.get(
    "/:userId/:date",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userReadLimiter,
    asyncHandler((req, res) => sleepController.getLogByDate(req, res)),
);

// ============================================================================
// WRITE ENDPOINTS
// ============================================================================

/**
 * POST /sleep/log
 * Save or update a single sleep log
 */
router.post(
    "/log",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userWriteLimiter,
    validate(sleepLogSchema),
    asyncHandler((req, res) => sleepController.saveLog(req, res)),
);

/**
 * POST /sleep/sync-batch
 * Batch sync multiple sleep records (up to 30 at a time)
 */
router.post(
    "/sync-batch",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userWriteLimiter,
    validate(sleepBatchSyncSchema),
    asyncHandler((req, res) => sleepController.syncBatch(req, res)),
);

/**
 * PATCH /sleep/log/:date/edit
 * Edit an existing sleep log with required edit reason
 */
router.patch(
    "/log/:date/edit",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userWriteLimiter,
    validate(sleepEditRequestSchema),
    asyncHandler((req, res) => sleepController.editLog(req, res)),
);

// ============================================================================
// DELETE ENDPOINTS
// ============================================================================

/**
 * DELETE /sleep/:userId/log/:date
 * Delete a specific sleep log
 */
router.delete(
    "/:userId/log/:date",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userWriteLimiter,
    asyncHandler((req, res) => sleepController.deleteLog(req, res)),
);

// Legacy route
router.delete(
    "/:userId/:date",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userWriteLimiter,
    asyncHandler((req, res) => sleepController.deleteLog(req, res)),
);

/**
 * DELETE /sleep/:userId/data
 * Purge all sleep data for a user (account deletion)
 */
router.delete(
    "/:userId/data",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userWriteLimiter,
    asyncHandler((req, res) => sleepController.purgeUserData(req, res)),
);

export const sleepRoutes = router;
