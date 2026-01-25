import express from "express";
import cors from "cors";
import { config } from "./config";
import { logger } from "./utils/logger";
import { healthRoutes } from "./routes/health";

import cookieParser from "cookie-parser";
import helmet from "helmet";
import { globalLimiter } from "./middleware/rateLimiter";
import { authRoutes } from "./modules/auth/auth.routes";
import { sleepRoutes } from "./modules/sleep/sleep.routes";
import { profileRoutes } from "./modules/profile/profile.routes";

const app = express();

app.use(helmet());
app.use(cors({
    origin: true, // Allow all origins for mobile app
    credentials: true, // Allow cookies
}));
app.use(express.json({ limit: "50mb" })); // Increase limit for avatar uploads
app.use(cookieParser());
app.use(globalLimiter);

// Routes
app.use("/health", healthRoutes);
app.use("/auth", authRoutes);
app.use("/api/sleep", sleepRoutes);
app.use("/api/profile", profileRoutes);

// Error handling middleware (placeholder for Phase 4)
app.use(
    (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        logger.error("Unhandled error", err);
        res.status(500).json({ error: "Internal Server Error" });
    },
);

app.listen(config.port, "0.0.0.0", () => {
    logger.info(`Server running on port ${config.port}`);
});
