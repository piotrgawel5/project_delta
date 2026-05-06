import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import { requireOwnership } from "../../middleware/authorization";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { burstLimiter, userReadLimiter, userWriteLimiter } from "../../middleware/rateLimiter";
import { nutritionController } from "./nutrition.controller";
import {
  nutritionLogsQuerySchema,
  nutritionLogsSyncSchema,
  nutritionLogDeleteSchema,
  nutritionFoodsSearchSchema,
  nutritionFoodsBarcodeSchema,
  nutritionFoodCreateSchema,
} from "./nutrition.validation";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Logs
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/logs/:userId",
  requireAuth,
  requireOwnership,
  burstLimiter,
  userReadLimiter,
  validate(nutritionLogsQuerySchema),
  asyncHandler((req, res) => nutritionController.getLogs(req, res)),
);

router.post(
  "/logs/sync",
  requireAuth,
  burstLimiter,
  userWriteLimiter,
  validate(nutritionLogsSyncSchema),
  asyncHandler((req, res) => nutritionController.syncLogs(req, res)),
);

router.delete(
  "/logs/:id",
  requireAuth,
  burstLimiter,
  userWriteLimiter,
  validate(nutritionLogDeleteSchema),
  asyncHandler((req, res) => nutritionController.deleteLog(req, res)),
);

// ─────────────────────────────────────────────────────────────────────────────
// Foods
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  "/foods/search",
  requireAuth,
  burstLimiter,
  userReadLimiter,
  validate(nutritionFoodsSearchSchema),
  asyncHandler((req, res) => nutritionController.searchFoods(req, res)),
);

router.get(
  "/foods/barcode/:code",
  requireAuth,
  burstLimiter,
  userReadLimiter,
  validate(nutritionFoodsBarcodeSchema),
  asyncHandler((req, res) => nutritionController.lookupBarcode(req, res)),
);

router.post(
  "/foods",
  requireAuth,
  burstLimiter,
  userWriteLimiter,
  validate(nutritionFoodCreateSchema),
  asyncHandler((req, res) => nutritionController.createFood(req, res)),
);

export const nutritionRoutes = router;
