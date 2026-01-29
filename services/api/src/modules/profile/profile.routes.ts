import { Router } from "express";
import { profileController } from "./profile.controller";
import { requireAuth } from "../auth/auth.middleware";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
    profileParamsSchema,
    updateProfileSchema,
    uploadAvatarSchema,
} from "./profile.validation";
import {
    burstLimiter,
    sensitiveOpLimiter,
    userReadLimiter,
} from "../../middleware/rateLimiter";
import { requireOwnership } from "../../middleware/authorization";

const router = Router();

// Get user profile
router.get(
    "/:userId",
    requireAuth,
    requireOwnership,
    burstLimiter,
    userReadLimiter,
    validate(profileParamsSchema),
    asyncHandler((req, res) => profileController.getProfile(req, res)),
);

// Update user profile (sensitive operation)
router.post(
    "/:userId",
    requireAuth,
    requireOwnership,
    burstLimiter,
    sensitiveOpLimiter,
    validate(profileParamsSchema.merge(updateProfileSchema)),
    asyncHandler((req, res) => profileController.updateProfile(req, res)),
);

// Alias for PUT method
router.put(
    "/:userId",
    requireAuth,
    requireOwnership,
    burstLimiter,
    sensitiveOpLimiter,
    validate(profileParamsSchema.merge(updateProfileSchema)),
    asyncHandler((req, res) => profileController.updateProfile(req, res)),
);

// Upload avatar (sensitive operation)
router.post(
    "/:userId/avatar",
    requireAuth,
    requireOwnership,
    burstLimiter,
    sensitiveOpLimiter,
    validate(profileParamsSchema.merge(uploadAvatarSchema)),
    asyncHandler((req, res) => profileController.uploadAvatar(req, res)),
);

// Delete avatar (sensitive operation)
router.delete(
    "/:userId/avatar",
    requireAuth,
    requireOwnership,
    burstLimiter,
    sensitiveOpLimiter,
    validate(profileParamsSchema),
    asyncHandler((req, res) => profileController.deleteAvatar(req, res)),
);

export const profileRoutes = router;
