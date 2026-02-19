// modules/screen-time/index.ts
// React Native bridge for ScreenTime native module

import { requireNativeModule } from "expo-modules-core";

function getPlatformOS(): string {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require("react-native").Platform?.OS ?? "web";
    } catch {
        return "web";
    }
}

const PLATFORM_OS = getPlatformOS();

// Types for screen time data
export interface ScreenEvent {
    timestamp: number;
    type: "SCREEN_ON" | "SCREEN_OFF" | "USER_INTERACTION";
    packageName: string;
}

export interface ScreenEventsResult {
    events: ScreenEvent[];
    startTime: number;
    endTime: number;
    count: number;
}

export interface AppUsageStat {
    packageName: string;
    totalTimeInForegroundMs: number;
    lastTimeUsed: number;
    firstTimeStamp: number;
    lastTimeStamp: number;
}

export interface AppUsageStatsResult {
    stats: AppUsageStat[];
    startTime: number;
    endTime: number;
}

export interface SleepWindowEstimate {
    success: true;
    estimatedBedtime: number; // Unix timestamp ms
    estimatedWakeup: number; // Unix timestamp ms
    durationMinutes: number;
    confidence: "high" | "medium" | "low";
    source: "usage_stats";
    totalEventsAnalyzed: number;
}

export interface SleepWindowEstimateFailed {
    success: false;
    reason: "INSUFFICIENT_DATA" | "NO_SLEEP_GAP_FOUND";
    eventCount?: number;
}

export type SleepWindowResult = SleepWindowEstimate | SleepWindowEstimateFailed;

export interface ScreenTimeSummary {
    totalScreenOnMinutes: number;
    screenOnCount: number;
    screenOffCount: number;
    firstEventTime: number;
    lastEventTime: number;
    periodMs: number;
}

export interface PermissionResult {
    success: boolean;
    openedSettings?: boolean;
    error?: string;
}

// Native module interface
interface ScreenTimeModuleInterface {
    hasPermission: () => Promise<boolean>;
    requestPermission: () => Promise<PermissionResult>;
    getScreenEvents: (
        startTimeMs: number,
        endTimeMs: number,
    ) => Promise<ScreenEventsResult>;
    getAppUsageStats: (
        startTimeMs: number,
        endTimeMs: number,
    ) => Promise<AppUsageStatsResult>;
    estimateSleepWindow: (
        startTimeMs: number,
        endTimeMs: number,
    ) => Promise<SleepWindowResult>;
    getScreenTimeSummary: (
        startTimeMs: number,
        endTimeMs: number,
    ) => Promise<ScreenTimeSummary>;
}

// Get the native module
const ScreenTimeModule: ScreenTimeModuleInterface | null =
    PLATFORM_OS === "android" ? requireNativeModule("ScreenTime") : null;

/**
 * Check if screen time (usage stats) permission is granted.
 * Only available on Android.
 */
export async function hasScreenTimePermission(): Promise<boolean> {
    if (PLATFORM_OS !== "android" || !ScreenTimeModule) {
        return false;
    }
    return ScreenTimeModule.hasPermission();
}

/**
 * Request screen time (usage stats) permission.
 * Opens the system settings page where user can grant access.
 * Only available on Android.
 */
export async function requestScreenTimePermission(): Promise<PermissionResult> {
    if (PLATFORM_OS !== "android" || !ScreenTimeModule) {
        return { success: false, error: "NOT_SUPPORTED" };
    }
    return ScreenTimeModule.requestPermission();
}

/**
 * Get screen on/off events for a time range.
 * Requires usage stats permission.
 *
 * @param startTime - Start of time range (Date or timestamp)
 * @param endTime - End of time range (Date or timestamp)
 */
export async function getScreenEvents(
    startTime: Date | number,
    endTime: Date | number,
): Promise<ScreenEventsResult> {
    if (PLATFORM_OS !== "android" || !ScreenTimeModule) {
        return { events: [], startTime: 0, endTime: 0, count: 0 };
    }

    const startMs = startTime instanceof Date ? startTime.getTime() : startTime;
    const endMs = endTime instanceof Date ? endTime.getTime() : endTime;

    return ScreenTimeModule.getScreenEvents(startMs, endMs);
}

/**
 * Get aggregated app usage statistics for a time range.
 * Returns top 20 apps by foreground time.
 *
 * @param startTime - Start of time range (Date or timestamp)
 * @param endTime - End of time range (Date or timestamp)
 */
export async function getAppUsageStats(
    startTime: Date | number,
    endTime: Date | number,
): Promise<AppUsageStatsResult> {
    if (PLATFORM_OS !== "android" || !ScreenTimeModule) {
        return { stats: [], startTime: 0, endTime: 0 };
    }

    const startMs = startTime instanceof Date ? startTime.getTime() : startTime;
    const endMs = endTime instanceof Date ? endTime.getTime() : endTime;

    return ScreenTimeModule.getAppUsageStats(startMs, endMs);
}

/**
 * Estimate sleep window from screen on/off patterns.
 * Finds the longest gap where the screen was off, which typically
 * corresponds to when the user was sleeping.
 *
 * @param startTime - Start of time range (typically 6 PM previous day)
 * @param endTime - End of time range (typically current time)
 */
export async function estimateSleepWindow(
    startTime: Date | number,
    endTime: Date | number,
): Promise<SleepWindowResult> {
    if (PLATFORM_OS !== "android" || !ScreenTimeModule) {
        return { success: false, reason: "INSUFFICIENT_DATA" };
    }

    const startMs = startTime instanceof Date ? startTime.getTime() : startTime;
    const endMs = endTime instanceof Date ? endTime.getTime() : endTime;

    return ScreenTimeModule.estimateSleepWindow(startMs, endMs);
}

/**
 * Get a summary of screen time for a period.
 * Includes total screen-on time, unlock counts, etc.
 *
 * @param startTime - Start of time range
 * @param endTime - End of time range
 */
export async function getScreenTimeSummary(
    startTime: Date | number,
    endTime: Date | number,
): Promise<ScreenTimeSummary> {
    if (Platform.OS !== "android" || !ScreenTimeModule) {
        return {
            totalScreenOnMinutes: 0,
            screenOnCount: 0,
            screenOffCount: 0,
            firstEventTime: 0,
            lastEventTime: 0,
            periodMs: 0,
        };
    }

    const startMs = startTime instanceof Date ? startTime.getTime() : startTime;
    const endMs = endTime instanceof Date ? endTime.getTime() : endTime;

    return ScreenTimeModule.getScreenTimeSummary(startMs, endMs);
}

/**
 * Helper to get time range for "last night" analysis.
 * Returns start at 6 PM yesterday and end at noon today.
 */
export function getLastNightTimeRange(): { startTime: Date; endTime: Date } {
    const now = new Date();

    // End time: noon today (or current time if before noon)
    const endTime = new Date(now);
    if (now.getHours() >= 12) {
        endTime.setHours(12, 0, 0, 0);
    }

    // Start time: 6 PM yesterday
    const startTime = new Date(endTime);
    startTime.setDate(startTime.getDate() - 1);
    startTime.setHours(18, 0, 0, 0);

    return { startTime, endTime };
}

/**
 * Backward-compatible alias used by tests and older call sites.
 * Returns unix timestamps in milliseconds.
 */
export function getTimeRangeForSleepEstimation(referenceDate?: Date): {
    startTime: number;
    endTime: number;
} {
    const now = referenceDate ?? new Date();
    const endTime = new Date(now);
    if (endTime.getHours() >= 12) {
        endTime.setHours(12, 0, 0, 0);
    }

    const startTime = new Date(endTime);
    startTime.setDate(startTime.getDate() - 1);
    startTime.setHours(18, 0, 0, 0);

    return { startTime: startTime.getTime(), endTime: endTime.getTime() };
}

/**
 * High-level function to get estimated sleep data from screen time.
 * Handles permission check and provides a clean result.
 */
export async function getEstimatedSleepFromScreenTime(): Promise<{
    available: boolean;
    hasPermission: boolean;
    estimate: SleepWindowResult | null;
    summary: ScreenTimeSummary | null;
}> {
    if (PLATFORM_OS !== "android") {
        return {
            available: false,
            hasPermission: false,
            estimate: null,
            summary: null,
        };
    }

    const hasPermission = await hasScreenTimePermission();
    if (!hasPermission) {
        return {
            available: true,
            hasPermission: false,
            estimate: null,
            summary: null,
        };
    }

    const { startTime, endTime } = getLastNightTimeRange();

    try {
        const [estimate, summary] = await Promise.all([
            estimateSleepWindow(startTime, endTime),
            getScreenTimeSummary(startTime, endTime),
        ]);

        return {
            available: true,
            hasPermission: true,
            estimate,
            summary,
        };
    } catch (error) {
        console.error("[ScreenTime] Error getting screen time data:", error);
        return {
            available: true,
            hasPermission: true,
            estimate: null,
            summary: null,
        };
    }
}

// Export module availability check
export const isScreenTimeAvailable = PLATFORM_OS === "android";
