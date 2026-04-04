import dotenv from "dotenv";
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
] as const;

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
    console.error(
        `Missing required environment variables: ${missingEnvVars.join(", ")}`,
    );
    process.exit(1);
}

const corsOriginsEnv = process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS ?? "";
const parsedCorsOrigins = corsOriginsEnv
    .split(",")
    .map((origin) => origin.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);

if ((process.env.NODE_ENV || "development") === "production" &&
    parsedCorsOrigins.length === 0) {
    console.error(
        "CORS_ORIGIN (or CORS_ORIGINS) must be set in production (comma-separated origins)",
    );
    process.exit(1);
}

export const config = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",

    supabase: {
        url: process.env.SUPABASE_URL!,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        anonKey: process.env.SUPABASE_ANON_KEY!,
    },

    passkey: {
        rpId: process.env.PASSKEY_RP_ID || "piotrgawel5.github.io",
        rpName: process.env.PASSKEY_RP_NAME || "Project Delta",
        rpOrigin: process.env.PASSKEY_RP_ORIGIN ||
            "https://piotrgawel5.github.io",
    },

    rateLimit: {
        windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
        max: Number(process.env.RATE_LIMIT_MAX) || 100,
    },

    cors: {
        origin: parsedCorsOrigins.length > 0 ? parsedCorsOrigins : true,
        credentials: true,
    },

    logging: {
        level: process.env.LOG_LEVEL || "info",
    },
} as const;

// Type export for config
export type Config = typeof config;
