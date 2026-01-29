import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

/**
 * Middleware to log incoming requests and outgoing responses
 */
export const requestLogger = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    const startTime = Date.now();

    // Log incoming request
    logger.info("Incoming request", {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        ip: req.ip,
        userAgent: req.get("user-agent"),
    });

    // Capture response on finish
    res.on("finish", () => {
        const duration = Date.now() - startTime;
        const logMethod = res.statusCode >= 400 ? "warn" : "info";

        logger[logMethod]("Request completed", {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
        });
    });

    next();
};
