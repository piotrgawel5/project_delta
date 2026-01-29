import { NextFunction, Request, Response } from "express";
import crypto from "crypto";

declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}

/**
 * Middleware to generate and attach a unique request ID for tracing
 */
export const requestIdMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    // Use existing header if provided (e.g., from load balancer)
    const requestId = (req.headers["x-request-id"] as string) ||
        crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);

    next();
};
