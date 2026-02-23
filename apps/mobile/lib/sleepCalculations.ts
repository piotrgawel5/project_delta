// lib/sleepCalculations.ts
// Deterministic sleep scoring with full provenance tracking
// Production-ready implementation for Project Delta Sleep Feature

import { ActivityLevel, Goal, Sex, UserProfile } from "@store/profileStore";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Data source enum - ordered by reliability
 */
export type DataSource =
    | "health_connect"
    | "digital_wellbeing"
    | "usage_stats"
    | "wearable"
    | "manual";

/**
 * Confidence level based on data completeness and source
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Sleep stage durations in minutes
 */
export interface SleepStages {
    deep: number;
    rem: number;
    light: number;
    awake: number;
}

/**
 * Deterministic score breakdown with component scores
 * All values sum to total (0-100)
 */
export interface SleepScoreBreakdown {
    /** Duration score: 0-35 points (35% weight) */
    duration_norm: number;
    /** Deep sleep percentage score: 0-20 points (20% weight) */
    deep_pct: number;
    /** REM sleep percentage score: 0-20 points (20% weight) */
    rem_pct: number;
    /** Sleep efficiency score: 0-15 points (15% weight) */
    efficiency: number;
    /** Consistency score: 0-10 points (10% weight) */
    consistency: number;
    /** Total score: 0-100 */
    total: number;
}

/**
 * Screen time summary from native module
 */
export interface ScreenTimeSummary {
    total_minutes: number;
    last_unlock_before_bedtime: string | null;
    first_unlock_after_wakeup: string | null;
    provenance: "usage_stats" | "digital_wellbeing" | "estimated";
}

/**
 * Complete provenance information for a sleep record
 */
export interface SleepRecordProvenance {
    source: DataSource;
    confidence: ConfidenceLevel;
    estimated_bedtime?: string;
    estimated_wakeup?: string;
    screen_time_summary?: ScreenTimeSummary;
}

/**
 * Edit record for tracking manual changes
 */
export interface SleepEditRecord {
    edited_at: string;
    edited_by: string;
    edit_reason: string;
    prev_record: Partial<SleepRecordWithScore>;
}

/**
 * Complete sleep record with scoring and provenance
 */
export interface SleepRecordWithScore {
    user_id: string;
    session_id?: string;
    date: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    stages: SleepStages;
    sleep_score: number;
    score_breakdown: SleepScoreBreakdown;
    source: DataSource;
    confidence: ConfidenceLevel;
    estimated_bedtime?: string;
    estimated_wakeup?: string;
    screen_time_summary?: ScreenTimeSummary;
    edits?: SleepEditRecord[];
}

/**
 * Sleep quality factors (legacy compatibility)
 */
interface SleepQualityFactors {
    durationScore: number;
    deepScore: number;
    remScore: number;
    consistencyScore: number;
    overallScore: number;
}

/**
 * Explainable insight with contributing signals
 */
export interface ExplainableInsight {
    title: string;
    message: string;
    predicted_delta: number;
    confidence: ConfidenceLevel;
    contributing_signals: Array<{
        signal: string;
        impact: number; // -100 to +100
        description: string;
    }>;
}

// ============================================================================
// SCORING WEIGHTS (deterministic, documented)
// ============================================================================

/**
 * Score weights - must sum to 100
 * These weights are based on sleep science research:
 * - Duration is most critical for overall health
 * - Deep sleep is essential for physical recovery
 * - REM is crucial for cognitive function and memory
 * - Efficiency indicates sleep quality
 * - Consistency supports circadian rhythm
 */
export const SCORE_WEIGHTS = {
    DURATION: 35,
    DEEP_SLEEP: 20,
    REM_SLEEP: 20,
    EFFICIENCY: 15,
    CONSISTENCY: 10,
} as const;

/**
 * Optimal targets based on sleep science
 */
export const OPTIMAL_TARGETS = {
    /** Optimal sleep duration in minutes (7.5-8.5 hours) */
    DURATION_MIN: 450,
    DURATION_MAX: 510,
    /** Optimal deep sleep percentage (15-25%) */
    DEEP_MIN_PCT: 0.15,
    DEEP_MAX_PCT: 0.25,
    DEEP_IDEAL_PCT: 0.20,
    /** Optimal REM percentage (20-25%) */
    REM_MIN_PCT: 0.20,
    REM_MAX_PCT: 0.25,
    REM_IDEAL_PCT: 0.22,
    /** Maximum acceptable awake time percentage */
    AWAKE_MAX_PCT: 0.10,
    /** Maximum std dev for high consistency (in minutes) */
    CONSISTENCY_MAX_STD: 60,
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) /
        values.length;
    return Math.sqrt(avgSquareDiff);
}

/**
 * Calculate user's age from date of birth
 */
function calculateAge(dateOfBirth: string | undefined): number {
    if (!dateOfBirth) return 35; // Default adult age
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return Math.max(18, Math.min(90, age));
}

// ============================================================================
// DETERMINISTIC SLEEP SCORE CALCULATION
// ============================================================================

/**
 * Calculate deterministic sleep score with full breakdown
 *
 * @param durationMinutes - Total sleep duration in minutes
 * @param stages - Sleep stage durations
 * @param historicalDurations - Optional array of last 7 days' durations for consistency
 * @param profile - Optional user profile for age-adjusted targets
 * @returns SleepScoreBreakdown with component scores and total
 *
 * @example
 * ```typescript
 * const breakdown = calculateLegacySleepScore(480, { deep: 90, rem: 100, light: 270, awake: 20 });
 * // { duration_norm: 35, deep_pct: 18, rem_pct: 18, efficiency: 13, consistency: 7, total: 91 }
 * ```
 */
/**
 * @deprecated Use `calculateSleepScore` from `@lib/sleepAnalysis` instead.
 */
export function calculateLegacySleepScore(
    durationMinutes: number,
    stages: SleepStages,
    historicalDurations: number[] = [],
    profile: UserProfile | null = null,
): SleepScoreBreakdown {
    // Edge case: no sleep
    if (durationMinutes <= 0) {
        return {
            duration_norm: 0,
            deep_pct: 0,
            rem_pct: 0,
            efficiency: 0,
            consistency: 0,
            total: 0,
        };
    }

    // Calculate age-adjusted optimal duration
    const age = profile ? calculateAge(profile.date_of_birth) : 35;
    let optimalDurationMin = OPTIMAL_TARGETS.DURATION_MIN;
    let optimalDurationMax = OPTIMAL_TARGETS.DURATION_MAX;

    // Adjust for age (older adults need slightly less, young adults need more)
    if (age < 25) {
        optimalDurationMin += 30;
        optimalDurationMax += 30;
    } else if (age >= 65) {
        optimalDurationMin -= 30;
        optimalDurationMax -= 30;
    }

    // Adjust for activity level
    if (profile?.activity_level === "very_active") {
        optimalDurationMin += 30;
        optimalDurationMax += 30;
    } else if (profile?.activity_level === "active") {
        optimalDurationMin += 15;
        optimalDurationMax += 15;
    }

    // 1. Duration score (0-35 points)
    let durationScore: number;
    if (
        durationMinutes >= optimalDurationMin &&
        durationMinutes <= optimalDurationMax
    ) {
        // Perfect range
        durationScore = SCORE_WEIGHTS.DURATION;
    } else if (durationMinutes < optimalDurationMin) {
        // Under-sleeping: linear penalty
        const ratio = durationMinutes / optimalDurationMin;
        durationScore = Math.round(SCORE_WEIGHTS.DURATION * Math.max(0, ratio));
    } else {
        // Over-sleeping: gentle penalty (some oversleep is okay)
        const excess = durationMinutes - optimalDurationMax;
        const penalty = Math.min(1, excess / 120); // Full penalty at 2 hours over
        durationScore = Math.round(
            SCORE_WEIGHTS.DURATION * (1 - penalty * 0.3),
        );
    }

    // 2. Deep sleep score (0-20 points)
    const totalSleepMinutes = stages.deep + stages.rem + stages.light;
    const deepPct = totalSleepMinutes > 0 ? stages.deep / totalSleepMinutes : 0;
    let deepScore: number;

    if (
        deepPct >= OPTIMAL_TARGETS.DEEP_MIN_PCT &&
        deepPct <= OPTIMAL_TARGETS.DEEP_MAX_PCT
    ) {
        // Within optimal range: grade by proximity to ideal (not flat max)
        const denom = deepPct <= OPTIMAL_TARGETS.DEEP_IDEAL_PCT
            ? OPTIMAL_TARGETS.DEEP_IDEAL_PCT - OPTIMAL_TARGETS.DEEP_MIN_PCT
            : OPTIMAL_TARGETS.DEEP_MAX_PCT - OPTIMAL_TARGETS.DEEP_IDEAL_PCT;
        const proximity = denom > 0
            ? 1 - Math.abs(deepPct - OPTIMAL_TARGETS.DEEP_IDEAL_PCT) / denom
            : 1;
        deepScore = Math.round(
            SCORE_WEIGHTS.DEEP_SLEEP * (0.7 + 0.3 * clamp(proximity, 0, 1)),
        );
    } else if (deepPct < OPTIMAL_TARGETS.DEEP_MIN_PCT) {
        // Below optimal
        const ratio = deepPct / OPTIMAL_TARGETS.DEEP_MIN_PCT;
        deepScore = Math.round(SCORE_WEIGHTS.DEEP_SLEEP * ratio);
    } else {
        // Above optimal (rare, but possible with some trackers)
        const excess = deepPct - OPTIMAL_TARGETS.DEEP_MAX_PCT;
        deepScore = Math.round(SCORE_WEIGHTS.DEEP_SLEEP * (1 - excess));
    }

    // 3. REM sleep score (0-20 points)
    const remPct = totalSleepMinutes > 0 ? stages.rem / totalSleepMinutes : 0;
    let remScore: number;

    if (
        remPct >= OPTIMAL_TARGETS.REM_MIN_PCT &&
        remPct <= OPTIMAL_TARGETS.REM_MAX_PCT
    ) {
        const denom = remPct <= OPTIMAL_TARGETS.REM_IDEAL_PCT
            ? OPTIMAL_TARGETS.REM_IDEAL_PCT - OPTIMAL_TARGETS.REM_MIN_PCT
            : OPTIMAL_TARGETS.REM_MAX_PCT - OPTIMAL_TARGETS.REM_IDEAL_PCT;
        const proximity = denom > 0
            ? 1 - Math.abs(remPct - OPTIMAL_TARGETS.REM_IDEAL_PCT) / denom
            : 1;
        remScore = Math.round(
            SCORE_WEIGHTS.REM_SLEEP * (0.7 + 0.3 * clamp(proximity, 0, 1)),
        );
    } else if (remPct < OPTIMAL_TARGETS.REM_MIN_PCT) {
        const ratio = remPct / OPTIMAL_TARGETS.REM_MIN_PCT;
        remScore = Math.round(SCORE_WEIGHTS.REM_SLEEP * ratio);
    } else {
        const excess = remPct - OPTIMAL_TARGETS.REM_MAX_PCT;
        remScore = Math.round(SCORE_WEIGHTS.REM_SLEEP * (1 - excess * 0.5));
    }

    // 4. Efficiency score (0-15 points)
    const totalInBed = durationMinutes;
    const awakePct = totalInBed > 0 ? stages.awake / totalInBed : 0;
    let efficiencyScore: number;

    if (awakePct <= 0.05) {
        // Excellent: < 5% awake time
        efficiencyScore = SCORE_WEIGHTS.EFFICIENCY;
    } else if (awakePct <= OPTIMAL_TARGETS.AWAKE_MAX_PCT) {
        // Good: 5-10% awake time
        const ratio = 1 - (awakePct - 0.05) / 0.05;
        efficiencyScore = Math.round(
            SCORE_WEIGHTS.EFFICIENCY * (0.7 + 0.3 * ratio),
        );
    } else {
        // Poor: > 10% awake time
        const excess = awakePct - OPTIMAL_TARGETS.AWAKE_MAX_PCT;
        const penalty = Math.min(1, excess / 0.15);
        efficiencyScore = Math.round(
            SCORE_WEIGHTS.EFFICIENCY * 0.7 * (1 - penalty),
        );
    }

    // 5. Consistency score (0-10 points)
    let consistencyScore: number;
    if (historicalDurations.length >= 3) {
        const stdDev = calculateStdDev([
            ...historicalDurations,
            durationMinutes,
        ]);
        if (stdDev <= 30) {
            consistencyScore = SCORE_WEIGHTS.CONSISTENCY;
        } else if (stdDev <= OPTIMAL_TARGETS.CONSISTENCY_MAX_STD) {
            const ratio = 1 - (stdDev - 30) / 30;
            consistencyScore = Math.round(SCORE_WEIGHTS.CONSISTENCY * ratio);
        } else {
            const excess = stdDev - OPTIMAL_TARGETS.CONSISTENCY_MAX_STD;
            consistencyScore = Math.round(
                SCORE_WEIGHTS.CONSISTENCY * Math.max(0, 1 - excess / 60),
            );
        }
    } else if (historicalDurations.length === 0) {
        // With no baseline history at all, be slightly conservative.
        consistencyScore = Math.round(SCORE_WEIGHTS.CONSISTENCY * 0.6);
    } else {
        // Not enough historical data: give partial score
        consistencyScore = Math.round(SCORE_WEIGHTS.CONSISTENCY * 0.7);
    }

    // Clamp all scores to their max weights
    durationScore = clamp(durationScore, 0, SCORE_WEIGHTS.DURATION);
    deepScore = clamp(deepScore, 0, SCORE_WEIGHTS.DEEP_SLEEP);
    remScore = clamp(remScore, 0, SCORE_WEIGHTS.REM_SLEEP);
    efficiencyScore = clamp(efficiencyScore, 0, SCORE_WEIGHTS.EFFICIENCY);
    consistencyScore = clamp(consistencyScore, 0, SCORE_WEIGHTS.CONSISTENCY);

    const shortDurationPenalty = durationMinutes < 360
        ? Math.round((360 - durationMinutes) / 3)
        : 0;
    const total = durationScore + deepScore + remScore + efficiencyScore +
        consistencyScore - shortDurationPenalty;

    return {
        duration_norm: durationScore,
        deep_pct: deepScore,
        rem_pct: remScore,
        efficiency: efficiencyScore,
        consistency: consistencyScore,
        total: clamp(total, 0, 100),
    };
}

// ============================================================================
// CONFIDENCE DETERMINATION
// ============================================================================

/**
 * Determine confidence level based on data source and completeness
 */
export function determineConfidence(
    source: DataSource,
    stages: SleepStages,
    hasHeartRate: boolean = false,
): ConfidenceLevel {
    // Manual entries always low confidence
    if (source === "manual") {
        return "low";
    }

    // Check if we have complete stage data
    const totalStages = stages.deep + stages.rem + stages.light + stages.awake;
    const hasCompleteStages = totalStages > 0 && stages.deep > 0 &&
        stages.rem > 0;

    // Health Connect or wearable with complete data = high
    if (
        (source === "health_connect" || source === "wearable") &&
        hasCompleteStages
    ) {
        return hasHeartRate ? "high" : "high";
    }

    // Health Connect without complete stages = medium
    if (source === "health_connect" || source === "wearable") {
        return "medium";
    }

    // Usage stats / digital wellbeing = medium at best
    if (source === "usage_stats" || source === "digital_wellbeing") {
        return hasCompleteStages ? "medium" : "low";
    }

    return "low";
}

// ============================================================================
// EXPLAINABLE INSIGHTS
// ============================================================================

/**
 * Generate explainable insights with top contributing signals
 * Uses deterministic rule engine (not ML black box)
 */
export function generateExplainableInsight(
    record: SleepRecordWithScore,
    historicalRecords: SleepRecordWithScore[] = [],
): ExplainableInsight {
    const signals: ExplainableInsight["contributing_signals"] = [];
    const { score_breakdown, stages, duration_minutes } = record;

    // Analyze each component
    const totalSleep = stages.deep + stages.rem + stages.light;

    // Duration analysis
    if (duration_minutes < OPTIMAL_TARGETS.DURATION_MIN) {
        const deficit = OPTIMAL_TARGETS.DURATION_MIN - duration_minutes;
        signals.push({
            signal: "Short sleep duration",
            impact: -Math.round((deficit / OPTIMAL_TARGETS.DURATION_MIN) * 100),
            description: `${Math.round(deficit / 60)}h ${
                deficit % 60
            }m below target`,
        });
    } else if (duration_minutes > OPTIMAL_TARGETS.DURATION_MAX + 60) {
        signals.push({
            signal: "Extended sleep duration",
            impact: -10,
            description: "Sleeping too long may indicate sleep quality issues",
        });
    }

    // Deep sleep analysis
    const deepPct = totalSleep > 0 ? stages.deep / totalSleep : 0;
    if (deepPct < OPTIMAL_TARGETS.DEEP_MIN_PCT) {
        signals.push({
            signal: "Low deep sleep",
            impact: -Math.round(
                (1 - deepPct / OPTIMAL_TARGETS.DEEP_MIN_PCT) * 50,
            ),
            description: `${
                Math.round(deepPct * 100)
            }% deep sleep (target: 15-25%)`,
        });
    } else if (deepPct >= OPTIMAL_TARGETS.DEEP_MAX_PCT) {
        signals.push({
            signal: "Excellent deep sleep",
            impact: 15,
            description: `${
                Math.round(deepPct * 100)
            }% deep sleep indicates good physical recovery`,
        });
    }

    // REM analysis
    const remPct = totalSleep > 0 ? stages.rem / totalSleep : 0;
    if (remPct < OPTIMAL_TARGETS.REM_MIN_PCT) {
        signals.push({
            signal: "Low REM sleep",
            impact: -Math.round(
                (1 - remPct / OPTIMAL_TARGETS.REM_MIN_PCT) * 40,
            ),
            description: `${
                Math.round(remPct * 100)
            }% REM (target: 20-25%). May affect memory consolidation.`,
        });
    }

    // Awake time analysis
    const awakePct = duration_minutes > 0 ? stages.awake / duration_minutes : 0;
    if (awakePct > OPTIMAL_TARGETS.AWAKE_MAX_PCT) {
        signals.push({
            signal: "High WASO (wake after sleep onset)",
            impact: -Math.round(
                (awakePct - OPTIMAL_TARGETS.AWAKE_MAX_PCT) * 200,
            ),
            description: `${
                Math.round(awakePct * 100)
            }% time awake (target: <10%)`,
        });
    }

    // Screen time analysis (if available)
    if (record.screen_time_summary?.last_unlock_before_bedtime) {
        const unlockTime = new Date(
            record.screen_time_summary.last_unlock_before_bedtime,
        );
        const bedtime = new Date(record.start_time);
        const minutesBefore = (bedtime.getTime() - unlockTime.getTime()) /
            60000;

        if (minutesBefore < 30) {
            signals.push({
                signal: "Late screen time",
                impact: -15,
                description:
                    "Screen activity within 30 minutes of bedtime may affect sleep quality",
            });
        }
    }

    // Sort by absolute impact and take top 3
    signals.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    const topSignals = signals.slice(0, 3);

    // Calculate predicted improvement
    const negativeSignals = topSignals.filter((s) => s.impact < 0);
    const predictedDelta = negativeSignals.length > 0
        ? Math.min(15, Math.round(Math.abs(negativeSignals[0].impact) * 0.3))
        : 0;

    // Generate actionable insight
    let title: string;
    let message: string;

    if (score_breakdown.total >= 85) {
        title = "Excellent Recovery Night";
        message =
            "Your sleep quality was optimal. Maintain your current sleep schedule.";
    } else if (negativeSignals.length > 0) {
        const topIssue = negativeSignals[0];
        if (topIssue.signal.includes("duration")) {
            title = "Sleep Duration Opportunity";
            message = `Adding ${
                Math.round(predictedDelta * 5)
            } minutes could improve your score by ~${predictedDelta} points.`;
        } else if (topIssue.signal.includes("deep")) {
            title = "Deep Sleep Optimization";
            message =
                "Try avoiding alcohol and heavy meals 3 hours before bed for better deep sleep.";
        } else if (topIssue.signal.includes("REM")) {
            title = "REM Sleep Recovery";
            message =
                "Consistent wake times help optimize REM cycles. Try waking at the same time daily.";
        } else if (
            topIssue.signal.includes("WASO") ||
            topIssue.signal.includes("awake")
        ) {
            title = "Sleep Fragmentation";
            message =
                "Reduce disturbances by keeping your room cool (65-68°F) and dark.";
        } else if (topIssue.signal.includes("screen")) {
            title = "Digital Wind-Down";
            message =
                "Try putting devices away 30 minutes before bed for better sleep onset.";
        } else {
            title = "Sleep Quality Insight";
            message = topIssue.description;
        }
    } else {
        title = "Good Sleep Pattern";
        message =
            "Your sleep is on track. Small improvements in consistency could boost your score.";
    }

    return {
        title,
        message,
        predicted_delta: predictedDelta,
        confidence: record.confidence,
        contributing_signals: topSignals,
    };
}

// ============================================================================
// LEGACY FUNCTIONS (preserved for backward compatibility)
// ============================================================================

/**
 * Get activity level multiplier for deep sleep
 * More active people need more deep sleep for physical recovery
 */
function getActivityMultiplier(
    activityLevel: ActivityLevel | undefined,
): number {
    const multipliers: Record<ActivityLevel, number> = {
        sedentary: 0.92,
        light: 1.0,
        moderate: 1.05,
        active: 1.12,
        very_active: 1.18,
    };
    return multipliers[activityLevel || "moderate"];
}

/**
 * Get goal-based adjustments
 */
function getGoalAdjustments(
    goal: Goal | undefined,
): { deepAdj: number; remAdj: number } {
    const adjustments: Record<Goal, { deepAdj: number; remAdj: number }> = {
        lose_weight: { deepAdj: 0, remAdj: 0 },
        maintain: { deepAdj: 0, remAdj: 0 },
        build_muscle: { deepAdj: 0.03, remAdj: -0.01 },
        improve_endurance: { deepAdj: 0.02, remAdj: 0.01 },
        stay_healthy: { deepAdj: 0.01, remAdj: 0.01 },
    };
    return adjustments[goal || "maintain"];
}

/**
 * Estimate sleep stages based on duration and user profile
 * Uses scientific research on sleep architecture variations
 */
export function estimateSleepStages(
    durationMinutes: number,
    profile: UserProfile | null,
): SleepStages {
    if (durationMinutes <= 0) {
        return { deep: 0, rem: 0, light: 0, awake: 0 };
    }

    const explicitAge = (profile as { age?: number } | null)?.age;
    const profileAge: number | null =
        typeof explicitAge === "number"
            ? explicitAge
            : profile?.date_of_birth
            ? calculateAge(profile.date_of_birth)
            : null;

    let deepPercent = 0.18;
    let remPercent = 0.22;
    let lightPercent = 0.52;
    let awakePercent = 0.08;

    if (profileAge !== null) {
        if (profileAge < 25) {
            deepPercent = 0.22;
            remPercent = 0.23;
            lightPercent = 0.50;
            awakePercent = 0.05;
        } else if (profileAge <= 44) {
            deepPercent = 0.18;
            remPercent = 0.22;
            lightPercent = 0.52;
            awakePercent = 0.08;
        } else if (profileAge <= 64) {
            deepPercent = 0.14;
            remPercent = 0.20;
            lightPercent = 0.56;
            awakePercent = 0.10;
        } else {
            deepPercent = 0.10;
            remPercent = 0.18;
            lightPercent = 0.60;
            awakePercent = 0.12;
        }
    }

    if (profile?.activity_level === "very_active") {
        deepPercent += 0.02;
        remPercent += 0.01;
        lightPercent -= 0.02;
        awakePercent -= 0.01;
    } else if (profile?.activity_level === "active") {
        deepPercent += 0.01;
        remPercent += 0.005;
        lightPercent -= 0.01;
        awakePercent -= 0.005;
    } else if (profile?.activity_level === "sedentary") {
        deepPercent -= 0.01;
        remPercent -= 0.005;
        lightPercent += 0.01;
        awakePercent += 0.005;
    }

    // Keep percentages valid and normalized.
    deepPercent = clamp(deepPercent, 0.05, 0.35);
    remPercent = clamp(remPercent, 0.10, 0.35);
    lightPercent = clamp(lightPercent, 0.30, 0.65);
    awakePercent = clamp(1 - deepPercent - remPercent - lightPercent, 0.02, 0.15);
    lightPercent = 1 - deepPercent - remPercent - awakePercent;

    return {
        deep: Math.round(durationMinutes * deepPercent),
        rem: Math.round(durationMinutes * remPercent),
        light: Math.round(durationMinutes * lightPercent),
        awake: Math.round(durationMinutes * awakePercent),
    };
}

/**
 * Calculate personalized sleep quality score (legacy)
 * @deprecated Use calculateSleepScore() from sleepAnalysis.ts instead
 */
export function calculatePersonalizedQuality(
    durationMinutes: number,
    stages: SleepStages,
    profile: UserProfile | null,
): SleepQualityFactors {
    const breakdown = calculateLegacySleepScore(durationMinutes, stages, [], profile);

    // Map new breakdown to legacy format
    return {
        durationScore: Math.round(
            (breakdown.duration_norm / SCORE_WEIGHTS.DURATION) * 100,
        ),
        deepScore: Math.round(
            (breakdown.deep_pct / SCORE_WEIGHTS.DEEP_SLEEP) * 100,
        ),
        remScore: Math.round(
            (breakdown.rem_pct / SCORE_WEIGHTS.REM_SLEEP) * 100,
        ),
        consistencyScore: Math.round(
            (breakdown.consistency / SCORE_WEIGHTS.CONSISTENCY) * 100,
        ),
        overallScore: breakdown.total,
    };
}

/**
 * Calculate quality score from duration when no stage data available
 * @deprecated Use calculateSleepScore() from sleepAnalysis.ts with estimated stages instead
 */
export function calculateQualityFromDuration(
    durationMinutes: number,
    profile: UserProfile | null,
): number {
    const stages = estimateSleepStages(durationMinutes, profile);
    const breakdown = calculateLegacySleepScore(durationMinutes, stages, [], profile);
    return breakdown.total;
}

/**
 * Analyze user sleep patterns from historical data
 */
export function analyzeUserSleepPatterns(
    history: Array<{
        duration_minutes: number;
        deep_sleep_minutes: number;
        rem_sleep_minutes: number;
        light_sleep_minutes: number;
        awake_minutes: number;
    }>,
): {
    avgDuration: number;
    avgDeepPercent: number;
    avgRemPercent: number;
    avgLightPercent: number;
    avgAwakePercent: number;
} | null {
    if (!history || history.length < 3) return null;

    const recent = history.slice(0, 7);

    const totals = recent.reduce(
        (acc, day) => ({
            duration: acc.duration + day.duration_minutes,
            deep: acc.deep + day.deep_sleep_minutes,
            rem: acc.rem + day.rem_sleep_minutes,
            light: acc.light + day.light_sleep_minutes,
            awake: acc.awake + day.awake_minutes,
        }),
        { duration: 0, deep: 0, rem: 0, light: 0, awake: 0 },
    );

    const count = recent.length;
    const avgDuration = totals.duration / count;

    return {
        avgDuration,
        avgDeepPercent: (totals.deep / totals.duration) * 100,
        avgRemPercent: (totals.rem / totals.duration) * 100,
        avgLightPercent: (totals.light / totals.duration) * 100,
        avgAwakePercent: (totals.awake / totals.duration) * 100,
    };
}

// ============================================================================
// P2: CIRCADIAN ALIGNMENT METRIC
// ============================================================================

/**
 * Circadian alignment score (0-10)
 * Measures how well sleep timing aligns with circadian rhythm
 *
 * Factors:
 * - Bedtime consistency (variance from ideal 10-11 PM)
 * - Wake time consistency (variance from ideal 6-7 AM)
 * - Sleep midpoint (should be around 3 AM for adults)
 * - Weekend/weekday drift
 */
export interface CircadianAlignmentResult {
    score: number; // 0-10
    bedtimeOffset: number; // Minutes from ideal bedtime
    wakeTimeOffset: number; // Minutes from ideal wake time
    midpointOffset: number; // Minutes from ideal midpoint (3 AM)
    consistencyScore: number; // 0-10 based on 7-day variance
    recommendation: string;
}

export function calculateCircadianAlignment(
    history: Array<{
        start_time: string;
        end_time: string;
        date: string;
    }>,
    idealBedtime: string = "22:30", // 10:30 PM
    idealWakeTime: string = "06:30", // 6:30 AM
): CircadianAlignmentResult | null {
    if (!history || history.length < 3) {
        return null;
    }

    const recent = history.slice(0, 7);

    // Parse ideal times
    const [idealBedHour, idealBedMin] = idealBedtime.split(":").map(Number);
    const [idealWakeHour, idealWakeMin] = idealWakeTime.split(":").map(Number);
    const idealBedMinutes = idealBedHour * 60 + idealBedMin;
    const idealWakeMinutes = idealWakeHour * 60 + idealWakeMin;
    const idealMidpoint = 3 * 60; // 3 AM in minutes from midnight

    const bedtimeOffsets: number[] = [];
    const wakeTimeOffsets: number[] = [];
    const midpointOffsets: number[] = [];

    for (const day of recent) {
        const bedDate = new Date(day.start_time);
        const wakeDate = new Date(day.end_time);

        // Bedtime minutes (adjusted for after-midnight bedtimes)
        let bedMinutes = bedDate.getHours() * 60 + bedDate.getMinutes();
        if (bedMinutes < 12 * 60) bedMinutes += 24 * 60; // Treat early morning as late night

        // Wake time minutes
        const wakeMinutes = wakeDate.getHours() * 60 + wakeDate.getMinutes();

        // Calculate midpoint
        let midpoint = (bedMinutes + wakeMinutes) / 2;
        if (midpoint > 24 * 60) midpoint -= 24 * 60;

        // Calculate offsets (absolute)
        let idealBedAdjusted = idealBedMinutes;
        if (idealBedAdjusted < 12 * 60) idealBedAdjusted += 24 * 60;

        bedtimeOffsets.push(Math.abs(bedMinutes - idealBedAdjusted));
        wakeTimeOffsets.push(Math.abs(wakeMinutes - idealWakeMinutes));
        midpointOffsets.push(Math.abs(midpoint - idealMidpoint));
    }

    // Average offsets
    const avgBedOffset = bedtimeOffsets.reduce((a, b) => a + b, 0) /
        bedtimeOffsets.length;
    const avgWakeOffset = wakeTimeOffsets.reduce((a, b) => a + b, 0) /
        wakeTimeOffsets.length;
    const avgMidpointOffset = midpointOffsets.reduce((a, b) => a + b, 0) /
        midpointOffsets.length;

    // Consistency score (based on standard deviation)
    const bedStdDev = calculateStdDev(bedtimeOffsets);
    const wakeStdDev = calculateStdDev(wakeTimeOffsets);
    const avgStdDev = (bedStdDev + wakeStdDev) / 2;
    const consistencyScore = clamp(10 - avgStdDev / 15, 0, 10);

    // Calculate component scores (each 0-2.5, totaling 10)
    const bedScore = clamp(2.5 - avgBedOffset / 60, 0, 2.5);
    const wakeScore = clamp(2.5 - avgWakeOffset / 60, 0, 2.5);
    const midScore = clamp(2.5 - avgMidpointOffset / 60, 0, 2.5);

    const totalScore = Math.round(
        (bedScore + wakeScore + midScore + consistencyScore / 4) * 10,
    ) / 10;

    // Generate recommendation
    let recommendation = "";
    if (totalScore >= 8) {
        recommendation =
            "Excellent circadian alignment! Keep maintaining your consistent schedule.";
    } else if (totalScore >= 6) {
        recommendation =
            "Good alignment. Try to go to bed within 30 minutes of your target time.";
    } else if (avgBedOffset > avgWakeOffset) {
        recommendation = `Consider moving bedtime ${
            Math.round(avgBedOffset / 15) * 15
        } minutes earlier.`;
    } else {
        recommendation =
            `Try to wake up closer to ${idealWakeTime} for better rhythm.`;
    }

    return {
        score: clamp(totalScore, 0, 10),
        bedtimeOffset: Math.round(avgBedOffset),
        wakeTimeOffset: Math.round(avgWakeOffset),
        midpointOffset: Math.round(avgMidpointOffset),
        consistencyScore: Math.round(consistencyScore * 10) / 10,
        recommendation,
    };
}

// ============================================================================
// P2: ROLLING SLEEP DEBT CALCULATION
// ============================================================================

/**
 * Rolling 7-day sleep debt calculation
 * Compares actual sleep to recommended sleep based on user age
 */
export interface SleepDebtResult {
    totalDebtMinutes: number;
    avgDailyDebtMinutes: number;
    debtLevel: "none" | "mild" | "moderate" | "severe";
    daysInDebt: number;
    recommendation: string;
    needsRecovery: boolean;
}

export function calculateRollingSleepDebt(
    history: Array<{
        duration_minutes: number;
        date: string;
    }>,
    userAge: number = 30,
): SleepDebtResult {
    // Recommended sleep by age (in minutes)
    let recommendedMinutes: number;
    if (userAge < 18) {
        recommendedMinutes = 9 * 60; // 9 hours
    } else if (userAge < 65) {
        recommendedMinutes = 8 * 60; // 8 hours
    } else {
        recommendedMinutes = 7.5 * 60; // 7.5 hours
    }

    const recent = history.slice(0, 7);
    let totalDebt = 0;
    let daysInDebt = 0;

    for (const day of recent) {
        const deficit = recommendedMinutes - day.duration_minutes;
        if (deficit > 0) {
            totalDebt += deficit;
            daysInDebt++;
        } else {
            // Recovery: partial credit for oversleep (max 30 min credit)
            totalDebt -= Math.min(-deficit * 0.5, 30);
        }
    }

    totalDebt = Math.max(0, totalDebt);
    const avgDaily = totalDebt / Math.max(recent.length, 1);

    // Determine debt level
    let debtLevel: "none" | "mild" | "moderate" | "severe";
    let needsRecovery = false;
    let recommendation = "";

    if (totalDebt <= 60) {
        debtLevel = "none";
        recommendation = "Your sleep balance is healthy. Keep it up!";
    } else if (totalDebt <= 180) {
        debtLevel = "mild";
        recommendation =
            "Minor sleep debt. Try to get an extra 30 minutes tonight.";
    } else if (totalDebt <= 360) {
        debtLevel = "moderate";
        needsRecovery = true;
        recommendation = "You've accumulated ~" + Math.round(totalDebt / 60) +
            " hours of sleep debt. Consider a recovery nap.";
    } else {
        debtLevel = "severe";
        needsRecovery = true;
        recommendation =
            "High sleep debt detected. Prioritize getting extra sleep this weekend.";
    }

    return {
        totalDebtMinutes: Math.round(totalDebt),
        avgDailyDebtMinutes: Math.round(avgDaily),
        debtLevel,
        daysInDebt,
        recommendation,
        needsRecovery,
    };
}

// ============================================================================
// P2: 5-NIGHT BEDTIME COACHING PLAN
// ============================================================================

/**
 * Generate a 5-night progressive bedtime adjustment plan
 * Helps users gradually shift their sleep schedule
 */
export interface BedtimeCoachingPlan {
    currentBedtime: string;
    targetBedtime: string;
    nights: Array<{
        night: number;
        bedtime: string;
        windDownStart: string;
        screenOffTime: string;
        tip: string;
    }>;
    totalShiftMinutes: number;
    estimatedBenefit: string;
}

export function generateBedtimeCoachingPlan(
    currentBedtime: string, // e.g., "23:30"
    targetBedtime: string = "22:30",
    currentCircadianScore?: number,
): BedtimeCoachingPlan {
    // Parse times
    const [currentHour, currentMin] = currentBedtime.split(":").map(Number);
    const [targetHour, targetMin] = targetBedtime.split(":").map(Number);

    let currentMinutes = currentHour * 60 + currentMin;
    let targetMinutes = targetHour * 60 + targetMin;

    // Handle crossing midnight
    if (currentMinutes < 12 * 60) currentMinutes += 24 * 60;
    if (targetMinutes < 12 * 60) targetMinutes += 24 * 60;

    const totalShift = currentMinutes - targetMinutes;
    const shiftPerNight = Math.ceil(totalShift / 5);

    const tips = [
        "Start dimming lights 2 hours before bed",
        "Take a warm shower 1 hour before target bedtime",
        "Practice 5-10 minutes of breathing exercises",
        "Avoid heavy meals within 3 hours of bedtime",
        "Keep bedroom cool (65-68°F / 18-20°C)",
    ];

    const nights = [];
    for (let i = 0; i < 5; i++) {
        const nightBedtimeMinutes = currentMinutes - (shiftPerNight * (i + 1));
        let adjustedMinutes = nightBedtimeMinutes;
        if (adjustedMinutes >= 24 * 60) adjustedMinutes -= 24 * 60;

        const hour = Math.floor(adjustedMinutes / 60) % 24;
        const min = adjustedMinutes % 60;
        const bedtime = `${hour.toString().padStart(2, "0")}:${
            min.toString().padStart(2, "0")
        }`;

        // Wind down 60 minutes before, screens off 30 minutes before
        const windDownMinutes = adjustedMinutes - 60;
        const screenOffMinutes = adjustedMinutes - 30;

        const formatTime = (m: number) => {
            let adj = m;
            if (adj < 0) adj += 24 * 60;
            if (adj >= 24 * 60) adj -= 24 * 60;
            return `${Math.floor(adj / 60).toString().padStart(2, "0")}:${
                (adj % 60).toString().padStart(2, "0")
            }`;
        };

        nights.push({
            night: i + 1,
            bedtime,
            windDownStart: formatTime(windDownMinutes),
            screenOffTime: formatTime(screenOffMinutes),
            tip: tips[i],
        });
    }

    // Estimated benefit
    let estimatedBenefit: string;
    if (totalShift >= 60) {
        estimatedBenefit =
            "Following this plan could improve your circadian score by 2-3 points and increase deep sleep by ~15%.";
    } else if (totalShift >= 30) {
        estimatedBenefit =
            "This adjustment should improve your sleep quality and morning energy levels.";
    } else {
        estimatedBenefit =
            "Fine-tuning your schedule will help optimize your natural sleep rhythm.";
    }

    return {
        currentBedtime,
        targetBedtime,
        nights,
        totalShiftMinutes: Math.abs(totalShift),
        estimatedBenefit,
    };
}

/**
 * Determine if user should be offered the bedtime coaching plan
 */
export function shouldOfferBedtimePlan(
    circadianScore: number,
    sleepDebt: SleepDebtResult,
    avgBedtime: string,
): { shouldOffer: boolean; reason: string } {
    // Offer if circadian alignment is poor
    if (circadianScore < 6) {
        return {
            shouldOffer: true,
            reason:
                "Your circadian alignment could use improvement. A gradual bedtime shift can help.",
        };
    }

    // Offer if moderate/severe sleep debt
    if (
        sleepDebt.debtLevel === "moderate" || sleepDebt.debtLevel === "severe"
    ) {
        return {
            shouldOffer: true,
            reason:
                "You've accumulated sleep debt. An earlier bedtime can help recover.",
        };
    }

    // Offer if bedtime is very late
    const [hour] = avgBedtime.split(":").map(Number);
    if (hour >= 0 && hour < 6) {
        return {
            shouldOffer: true,
            reason:
                "Going to bed after midnight can affect sleep quality. Let's adjust gradually.",
        };
    }

    return {
        shouldOffer: false,
        reason: "Your sleep schedule looks healthy!",
    };
}
