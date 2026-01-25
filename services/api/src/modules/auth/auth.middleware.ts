import { NextFunction, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { logger } from "../../utils/logger";

// Create a Supabase client for auth validation
// We use the anon key here if just verifying, or service role if we need admin privileges.
// But for getUser(token), we just need a client.
// Actually, to use getUser(token), we can create a client with that token.

export const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    try {
        let token = req.headers.authorization?.split(" ")[1];

        if (!token && req.cookies && req.cookies["sb-access-token"]) {
            token = req.cookies["sb-access-token"];
        }

        if (!token) {
            return res.status(401).json({
                error: "Unauthorized: No token provided",
            });
        }

        const supabase = createClient(
            config.supabase.url!,
            config.supabase.serviceRoleKey!,
        );

        // Verify the token and get the user
        // Using admin.getUserById isn't right for token validation.
        // We should use getUser with the token.

        // Helper to create a client scoped to the user
        // This is safer to ensure RLS is respected if we used this client for data
        // But here we just want to know WHO it is.
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            logger.warn("Auth validation failed", { error: error?.message });
            return res.status(401).json({
                error: "Unauthorized: Invalid token",
            });
        }

        // Attach user to request
        (req as any).user = user;
        next();
    } catch (error) {
        logger.error("Auth middleware error", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
