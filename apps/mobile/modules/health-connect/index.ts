// modules/health-connect/index.ts
import { Platform, requireNativeModule } from "expo-modules-core";
import type {
    AvailabilityStatus,
    PermissionStatus,
    SleepMetrics,
    SleepSession,
    SleepStageType,
} from "./src/types";

export * from "./src/types";

const HealthConnectModule = requireNativeModule("HealthConnect");

/**
 * Check if Health Connect is available on this device
 */
export async function isAvailable(): Promise<AvailabilityStatus> {
    if (Platform.OS !== "android") {
        return {
            available: false,
            reason: "NOT_SUPPORTED",
        };
    }
    return HealthConnectModule.isAvailable();
}

/**
 * Request health permissions from the user
 * On Android 14+, this shows the native Health Connect permission UI
 */
export async function requestPermissions(): Promise<PermissionStatus[]> {
    if (Platform.OS !== "android") {
        throw new Error("Health Connect is only available on Android");
    }
    return HealthConnectModule.requestPermissions();
}

/**
 * Check current permission status without prompting
 */
export async function checkPermissions(): Promise<PermissionStatus[]> {
    if (Platform.OS !== "android") {
        return [
            { permission: "READ_SLEEP", granted: false },
            { permission: "WRITE_SLEEP", granted: false },
        ];
    }
    return HealthConnectModule.checkPermissions();
}

/**
 * Open the Health Connect app settings
 */
export async function openHealthConnectSettings(): Promise<void> {
    if (Platform.OS !== "android") {
        throw new Error("Health Connect is only available on Android");
    }
    return HealthConnectModule.openHealthConnectSettings();
}

/**
 * Write a sleep session to Health Connect
 * @param startTime - ISO 8601 timestamp for sleep start
 * @param endTime - ISO 8601 timestamp for sleep end
 * @param title - Optional title for the session
 */
export async function writeSleepSession(
    startTime: string,
    endTime: string,
    title?: string,
): Promise<{ success: boolean; startTime: string; endTime: string }> {
    if (Platform.OS !== "android") {
        throw new Error("Health Connect is only available on Android");
    }
    return HealthConnectModule.writeSleepSession(startTime, endTime, title);
}

/**
 * Get sleep sessions within a time range
 * @param startTime - ISO 8601 timestamp for range start
 * @param endTime - ISO 8601 timestamp for range end
 */
export async function getSleepSessions(
    startTime: string,
    endTime: string,
): Promise<SleepSession[]> {
    if (Platform.OS !== "android") {
        throw new Error("Health Connect is only available on Android");
    }
    return HealthConnectModule.getSleepSessions(startTime, endTime);
}

/**
 * Get aggregated sleep metrics for a time range
 * @param startTime - ISO 8601 timestamp for range start
 * @param endTime - ISO 8601 timestamp for range end
 */
export async function getSleepMetrics(
    startTime: string,
    endTime: string,
): Promise<SleepMetrics> {
    if (Platform.OS !== "android") {
        throw new Error("Health Connect is only available on Android");
    }
    return HealthConnectModule.getSleepMetrics(startTime, endTime);
}

/**
 * Get last night's sleep session (convenience method)
 */
export async function getLastNightSleep(): Promise<SleepSession | null> {
    if (Platform.OS !== "android") {
        return null;
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 0, 0, 0); // Start from 6 PM yesterday

    const sessions = await getSleepSessions(
        yesterday.toISOString(),
        now.toISOString(),
    );

    if (sessions.length === 0) {
        return null;
    }

    // Return the most recent session
    return sessions.sort(
        (a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime(),
    )[0];
}

/**
 * Calculate sleep quality score based on sleep stages
 */
export function calculateSleepQuality(session: SleepSession): number {
    if (!session.stages || session.stages.length === 0) {
        return 0;
    }

    let deepMinutes = 0;
    let remMinutes = 0;
    let lightMinutes = 0;
    let awakeMinutes = 0;

    for (const stage of session.stages) {
        const duration = (new Date(stage.endTime).getTime() -
            new Date(stage.startTime).getTime()) / 60000;

        switch (stage.stage) {
            case 5: // DEEP
                deepMinutes += duration;
                break;
            case 6: // REM
                remMinutes += duration;
                break;
            case 4: // LIGHT
                lightMinutes += duration;
                break;
            case 1: // AWAKE
                awakeMinutes += duration;
                break;
        }
    }

    const totalSleep = deepMinutes + remMinutes + lightMinutes;
    if (totalSleep === 0) return 0;

    // Quality score based on ideal sleep composition
    // Ideal: 20-25% deep, 20-25% REM, minimal awake time
    const deepRatio = deepMinutes / totalSleep;
    const remRatio = remMinutes / totalSleep;
    const awakeRatio = awakeMinutes / (totalSleep + awakeMinutes);

    let score = 50; // Base score

    // Deep sleep bonus (ideal 20-25%)
    if (deepRatio >= 0.15 && deepRatio <= 0.30) {
        score += 20;
    } else if (deepRatio >= 0.10) {
        score += 10;
    }

    // REM sleep bonus (ideal 20-25%)
    if (remRatio >= 0.15 && remRatio <= 0.30) {
        score += 20;
    } else if (remRatio >= 0.10) {
        score += 10;
    }

    // Awake penalty
    if (awakeRatio < 0.05) {
        score += 10;
    } else if (awakeRatio > 0.15) {
        score -= 15;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}

export default {
    isAvailable,
    requestPermissions,
    checkPermissions,
    openHealthConnectSettings,
    getSleepSessions,
    getSleepMetrics,
    getLastNightSleep,
    calculateSleepQuality,
};
