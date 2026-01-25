import { Router } from "express";
import { authController } from "./auth.controller";
import { requireAuth } from "./auth.middleware";
import { authLimiter } from "../../middleware/rateLimiter";
import { validate } from "../../middleware/validate";
import {
    emailAuthSchema,
    passkeyRegisterOptionsSchema,
    passkeyVerifySchema,
} from "./auth.validation";

const router = Router();

router.post(
    "/passkey/register/options",
    validate(passkeyRegisterOptionsSchema),
    (req, res) => authController.registerPasskeyOptions(req, res),
);
router.post(
    "/passkey/register/verify",
    validate(passkeyVerifySchema),
    (req, res) => authController.registerPasskeyVerify(req, res),
);
router.post(
    "/passkey/login/options",
    (req, res) => authController.loginPasskeyOptions(req, res),
);
router.post(
    "/passkey/login/verify",
    authLimiter,
    (req, res) => authController.loginPasskeyVerify(req, res),
);

router.post(
    "/email/login",
    authLimiter,
    validate(emailAuthSchema),
    (req, res) => authController.loginEmail(req, res),
);
router.post(
    "/email/signup",
    authLimiter,
    validate(emailAuthSchema),
    (req, res) => authController.signupEmail(req, res),
);
router.get("/me", requireAuth, (req, res) => authController.me(req, res));

router.post("/logout", (req, res) => authController.logout(req, res));

export const authRoutes = router;
