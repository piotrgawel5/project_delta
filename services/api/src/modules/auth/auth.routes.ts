import { Router } from "express";
import { authController } from "./auth.controller";
import { requireAuth } from "./auth.middleware";
import { authOptionsLimiter, authVerifyLimiter } from "../../middleware/rateLimiter";
import { validate } from "../../middleware/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import {
    emailAuthSchema,
    googleAuthSchema,
    passkeyLoginVerifySchema,
    passkeyRegisterOptionsSchema,
    passkeyVerifySchema,
} from "./auth.validation";

const router = Router();

// Passkey Registration
router.post(
    "/passkey/register/options",
    authOptionsLimiter,
    validate(passkeyRegisterOptionsSchema),
    asyncHandler((req, res) => authController.registerPasskeyOptions(req, res)),
);

router.post(
    "/passkey/register/verify",
    authVerifyLimiter,
    validate(passkeyVerifySchema),
    asyncHandler((req, res) => authController.registerPasskeyVerify(req, res)),
);

// Passkey Login
router.post(
    "/passkey/login/options",
    authOptionsLimiter,
    asyncHandler((req, res) => authController.loginPasskeyOptions(req, res)),
);

router.post(
    "/passkey/login/verify",
    authVerifyLimiter,
    validate(passkeyLoginVerifySchema),
    asyncHandler((req, res) => authController.loginPasskeyVerify(req, res)),
);

// Email Authentication
router.post(
    "/email/login",
    authVerifyLimiter,
    validate(emailAuthSchema),
    asyncHandler((req, res) => authController.loginEmail(req, res)),
);

router.post(
    "/email/signup",
    authVerifyLimiter,
    validate(emailAuthSchema),
    asyncHandler((req, res) => authController.signupEmail(req, res)),
);

// Google Authentication
router.post(
    "/google/login",
    authVerifyLimiter,
    validate(googleAuthSchema),
    asyncHandler((req, res) => authController.loginGoogle(req, res)),
);

// Get current user
router.get(
    "/me",
    requireAuth,
    asyncHandler((req, res) => authController.me(req, res)),
);

// Logout
router.post(
    "/logout",
    requireAuth,
    asyncHandler((req, res) => authController.logout(req, res)),
);

router.delete(
    "/account",
    requireAuth,
    asyncHandler((req, res) => authController.deleteAccount(req, res)),
);

export const authRoutes = router;
