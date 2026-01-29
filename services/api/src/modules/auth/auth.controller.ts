import { Request, Response } from "express";
import { authService } from "./auth.service";
import { logger } from "../../utils/logger";
import { config } from "../../config";

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

// Separate options for clearCookie (without maxAge to avoid deprecation warning)
const CLEAR_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax" as const,
    path: "/",
};

export class AuthController {
    // Passkey Registration
    async registerPasskeyOptions(req: Request, res: Response) {
        try {
            const { email } = req.body;
            const options = await authService.getRegistrationOptions(email);
            res.json(options);
        } catch (error: any) {
            logger.error("registerPasskeyOptions error", error);
            res.status(400).json({ error: error.message });
        }
    }

    async registerPasskeyVerify(req: Request, res: Response) {
        try {
            const { email, credential } = req.body;
            const { session, user_id } = await authService.verifyRegistration(
                email,
                credential,
            );

            this.setCookies(res, session);

            res.json({
                verified: true,
                user_id,
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            });
        } catch (error: any) {
            logger.error("registerPasskeyVerify error", error);
            res.status(400).json({ error: error.message });
        }
    }

    // Passkey Login
    async loginPasskeyOptions(req: Request, res: Response) {
        try {
            const options = await authService.getLoginOptions();
            res.json(options);
        } catch (error: any) {
            logger.error("loginPasskeyOptions error", error);
            res.status(400).json({ error: error.message });
        }
    }

    async loginPasskeyVerify(req: Request, res: Response) {
        try {
            const { credential, challengeId } = req.body;
            const { session, user_id } = await authService.verifyLogin(
                credential,
                challengeId,
            );

            this.setCookies(res, session);

            res.json({
                verified: true,
                user_id,
                access_token: session.access_token,
                refresh_token: session.refresh_token,
            });
        } catch (error: any) {
            logger.error("loginPasskeyVerify error", error);
            res.status(400).json({ error: error.message });
        }
    }

    // Email Auth
    async loginEmail(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            const session = await authService.signInWithPassword(
                email,
                password,
            );

            if (session) {
                this.setCookies(res, session);
                res.json({
                    user: session.user,
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                });
            } else {
                res.status(401).json({ error: "Auth failed" });
            }
        } catch (error: any) {
            logger.error("loginEmail error", error);
            res.status(400).json({ error: error.message });
        }
    }

    async signupEmail(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            const session = await authService.signUpWithPassword(
                email,
                password,
            );

            if (session) {
                this.setCookies(res, session);
                res.json({
                    user: session.user,
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                });
            } else {
                // Confirmation email sent
                res.json({ message: "Confirmation email sent" });
            }
        } catch (error: any) {
            logger.error("signupEmail error", error);
            res.status(400).json({ error: error.message });
        }
    }

    async loginGoogle(req: Request, res: Response) {
        try {
            const { idToken } = req.body;
            const session = await authService.signInWithIdToken(idToken);

            if (session) {
                this.setCookies(res, session);
                res.json({
                    user: session.user,
                    access_token: session.access_token,
                    refresh_token: session.refresh_token,
                });
            } else {
                res.status(401).json({ error: "Google auth failed" });
            }
        } catch (error: any) {
            logger.error("loginGoogle error", error);
            res.status(400).json({ error: error.message });
        }
    }

    async logout(req: Request, res: Response) {
        try {
            const token = req.cookies["sb-access-token"];
            if (token) {
                await authService.signOut(token);
            }
        } catch (e) {
            // ignore
        }

        res.clearCookie("sb-access-token", CLEAR_COOKIE_OPTIONS);
        res.clearCookie("sb-refresh-token", CLEAR_COOKIE_OPTIONS);
        res.json({ success: true });
    }

    async me(req: Request, res: Response) {
        const user = (req as any).user;
        const access_token = req.cookies["sb-access-token"] ||
            req.headers.authorization?.split(" ")[1];
        const refresh_token = req.cookies["sb-refresh-token"];

        res.json({
            user,
            access_token,
            refresh_token,
        });
    }

    private setCookies(res: Response, session: any) {
        res.cookie("sb-access-token", session.access_token, {
            ...COOKIE_OPTIONS,
            maxAge: session.expires_in * 1000,
        });
        res.cookie("sb-refresh-token", session.refresh_token, COOKIE_OPTIONS);

        // Also return tokens for in-memory usage (Phase 3 transition)
        // NOTE: This does not persist them on client, only for current session state
    }
}

export const authController = new AuthController();
