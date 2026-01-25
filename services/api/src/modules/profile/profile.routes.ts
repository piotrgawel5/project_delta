import { Router } from "express";
import { profileController } from "./profile.controller";
import { requireAuth } from "../auth/auth.middleware";

const router = Router();

router.get(
    "/:userId",
    requireAuth,
    (req, res) => profileController.getProfile(req, res),
);
router.post(
    "/:userId",
    requireAuth,
    (req, res) => profileController.updateProfile(req, res),
); // Using POST for upsert/update convenience, could be PUT
router.post(
    "/:userId/avatar",
    requireAuth,
    (req, res) => profileController.uploadAvatar(req, res),
);

export const profileRoutes = router;
