import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { config } from "./config";
import { logger } from "./utils/logger";

// Middleware
import { globalLimiter } from "./middleware/rateLimiter";
import { requestIdMiddleware } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// Routes
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./modules/auth/auth.routes";
import { sleepRoutes } from "./modules/sleep/sleep.routes";
import { profileRoutes } from "./modules/profile/profile.routes";

const app = express();

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Request ID middleware (must be first for tracking)
app.use(requestIdMiddleware);

// CORS configuration
app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
}));

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging (after body parsing)
app.use(requestLogger);

// Rate limiting (skip for health checks)
app.use((req, res, next) => {
    if (req.path === "/health") {
        return next();
    }
    globalLimiter(req, res, next);
});

// Routes
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/api/sleep", sleepRoutes);
app.use("/api/profile", profileRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Unhandled rejection handler
process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection", { reason, promise });
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception", {
        error: error.message,
        stack: error.stack,
    });
    process.exit(1);
});

// Start server
app.listen(config.port, "0.0.0.0", () => {
    logger.info(`Server running on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port,
    });
});

export default app;
