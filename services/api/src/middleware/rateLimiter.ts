import rateLimit, { Options } from "express-rate-limit";
import { Request, Response } from "express";
import { logger } from "../utils/logger";

// Custom key generator for user-based limiting
const getUserKey = (req: Request): string => {
    // Use user ID if authenticated, otherwise fall back to IP
    const user = (req as any).user;
    if (user?.id) {
        return `user:${user.id}`;
    }
    // Fall back to IP address
    return `ip:${req.ip || req.socket.remoteAddress || "unknown"}`;
};

// Standard response for rate limit exceeded
const rateLimitResponse = (message: string) => ({
    success: false,
    error: {
        code: "RATE_LIMIT_EXCEEDED",
        message,
    },
});

// Logging handler for rate limit hits
const onLimitReached = (req: Request, _res: Response, options: Options) => {
    logger.warn("Rate limit exceeded", {
        requestId: req.requestId,
        key: getUserKey(req),
        path: req.path,
        method: req.method,
        limit: options.max,
    });
};

/**
 * Global rate limiter - applies to all routes
 * 100 requests per 15 minutes per IP
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitResponse("Too many requests, please try again later."),
    handler: (req, res, _next, options) => {
        onLimitReached(req, res, options);
        res.status(429).json(options.message);
    },
});

/**
 * Authentication rate limiter - stricter limits for auth endpoints
 * 10 requests per hour per IP (prevents brute force)
 */
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitResponse(
        "Too many authentication attempts. Try again later.",
    ),
    handler: (req, res, _next, options) => {
        onLimitReached(req, res, options);
        res.status(429).json(options.message);
    },
});

/**
 * Per-user write rate limiter - limits data modifications per user
 * 30 write operations per 15 minutes per user
 */
export const userWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getUserKey,
    message: rateLimitResponse("Too many write operations. Please slow down."),
    handler: (req, res, _next, options) => {
        onLimitReached(req, res, options);
        res.status(429).json(options.message);
    },
});

/**
 * Per-user read rate limiter - limits data reads per user
 * 100 read operations per 15 minutes per user
 */
export const userReadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getUserKey,
    message: rateLimitResponse("Too many requests. Please slow down."),
    handler: (req, res, _next, options) => {
        onLimitReached(req, res, options);
        res.status(429).json(options.message);
    },
});

/**
 * Strict rate limiter for sensitive operations (e.g., password reset, profile updates)
 * 5 requests per hour per user
 */
export const sensitiveOpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getUserKey,
    message: rateLimitResponse(
        "Too many sensitive operations. Try again later.",
    ),
    handler: (req, res, _next, options) => {
        onLimitReached(req, res, options);
        res.status(429).json(options.message);
    },
});

/**
 * Burst protection - prevents rapid-fire requests
 * 10 requests per 10 seconds per user
 */
export const burstLimiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: getUserKey,
    message: rateLimitResponse(
        "Too many requests in a short time. Please slow down.",
    ),
    skipFailedRequests: true, // Don't count failed requests
    handler: (req, res, _next, options) => {
        onLimitReached(req, res, options);
        res.status(429).json(options.message);
    },
});
