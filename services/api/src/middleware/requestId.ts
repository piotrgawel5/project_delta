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
    const clientId = req.headers["x-request-id"] as string | undefined;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const requestId = clientId && UUID_RE.test(clientId) ? clientId : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);

    next();
};
