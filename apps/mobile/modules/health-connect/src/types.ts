// modules/health-connect/src/types.ts

/**
 * Sleep stage types from Health Connect
 */
export enum SleepStageType {
    UNKNOWN = 0,
    AWAKE = 1,
    SLEEPING = 2,
    OUT_OF_BED = 3,
    LIGHT = 4,
    DEEP = 5,
    REM = 6,
}

/**
 * Individual sleep stage within a session
 */
export interface SleepStage {
    startTime: string; // ISO 8601 timestamp
    endTime: string; // ISO 8601 timestamp
    stage: SleepStageType;
}

/**
 * A complete sleep session from Health Connect
 */
export interface SleepSession {
    id: string;
    startTime: string; // ISO 8601 timestamp
    endTime: string; // ISO 8601 timestamp
    title?: string;
    notes?: string;
    stages: SleepStage[];
    metadata: {
        dataOrigin: string; // Package name of app that recorded this
        lastModifiedTime: string;
    };
}

/**
 * Aggregated sleep metrics
 */
export interface SleepMetrics {
    totalDurationMinutes: number;
    awakeDurationMinutes: number;
    lightSleepMinutes: number;
    deepSleepMinutes: number;
    remSleepMinutes: number;
    sleepEfficiency: number; // Percentage 0-100
}

/**
 * Health Connect permission types for sleep
 */
export type HealthPermission = "READ_SLEEP" | "WRITE_SLEEP";

/**
 * Permission status
 */
export interface PermissionStatus {
    permission: HealthPermission;
    granted: boolean;
}

/**
 * Health Connect availability status
 */
export interface AvailabilityStatus {
    available: boolean;
    reason?: "NOT_INSTALLED" | "NOT_SUPPORTED" | "AVAILABLE";
    sdkStatus?: number;
}
