import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

/**
 * Middleware to ensure the authenticated user can only access their own resources
 * Checks if the :userId parameter matches the authenticated user's ID
 */
export function requireOwnership(
    req: Request,
    _res: Response,
    next: NextFunction,
) {
    const user = (req as any).user;
    const requestedUserId = req.params.userId || req.body?.user_id;

    if (!user?.id) {
        throw AppError.unauthorized("Authentication required");
    }

    if (!requestedUserId) {
        // No userId to check, let the route handle it
        return next();
    }

    if (user.id !== requestedUserId) {
        throw AppError.forbidden("You can only access your own data");
    }

    next();
}

/**
 * Middleware that checks if user is an admin (extend as needed)
 * For now, this is a placeholder - implement admin checks based on your user roles
 */
export function requireAdmin(
    req: Request,
    _res: Response,
    next: NextFunction,
) {
    const user = (req as any).user;

    if (!user?.id) {
        throw AppError.unauthorized("Authentication required");
    }

    // TODO: Implement admin role check based on your user schema
    // For now, no one is admin
    throw AppError.forbidden("Admin access required");
}
