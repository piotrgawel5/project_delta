import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";
import { logger } from "../utils/logger";
import { config } from "../config";

/**
 * Global error handler middleware
 */
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    _next: NextFunction,
) => {
    // Log the error
    logger.error("Error occurred", {
        requestId: req.requestId,
        error: err.message,
        stack: config.nodeEnv === "development" ? err.stack : undefined,
        path: req.path,
        method: req.method,
    });

    // Handle AppError instances
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
            },
            requestId: req.requestId,
        });
    }

    // Handle Zod validation errors
    if (err.name === "ZodError") {
        return res.status(400).json({
            success: false,
            error: {
                code: "VALIDATION_ERROR",
                message: "Validation failed",
                details: (err as any).errors,
            },
            requestId: req.requestId,
        });
    }

    // Handle unknown errors
    const statusCode = 500;
    const message = config.nodeEnv === "production"
        ? "Internal server error"
        : err.message;

    return res.status(statusCode).json({
        success: false,
        error: {
            code: "INTERNAL_ERROR",
            message,
        },
        requestId: req.requestId,
    });
};

/**
 * Handle 404 - Route not found
 */
export const notFoundHandler = (
    req: Request,
    res: Response,
    _next: NextFunction,
) => {
    res.status(404).json({
        success: false,
        error: {
            code: "NOT_FOUND",
            message: `Route ${req.method} ${req.path} not found`,
        },
        requestId: req.requestId,
    });
};
