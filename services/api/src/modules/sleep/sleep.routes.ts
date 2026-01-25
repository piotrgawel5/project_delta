import { Router } from "express";
import { sleepController } from "./sleep.controller";
import { requireAuth } from "../auth/auth.middleware";

const router = Router();

router.get(
    "/:userId/history",
    requireAuth,
    (req, res) => sleepController.getHistory(req, res),
);
router.post(
    "/log",
    requireAuth,
    (req, res) => sleepController.saveLog(req, res),
);

export const sleepRoutes = router;
