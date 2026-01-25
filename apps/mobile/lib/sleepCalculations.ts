// lib/sleepCalculations.ts
// Personalized sleep phase estimation based on user profile data

import { ActivityLevel, Goal, Sex, UserProfile } from "@store/profileStore";

interface SleepStages {
    deep: number;
    rem: number;
    light: number;
    awake: number;
}

interface SleepQualityFactors {
    durationScore: number;
    deepScore: number;
    remScore: number;
    consistencyScore: number;
    overallScore: number;
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

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

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
        build_muscle: { deepAdj: 0.03, remAdj: -0.01 }, // More deep for muscle recovery
        improve_endurance: { deepAdj: 0.02, remAdj: 0.01 }, // Both for cardiovascular health
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

    // Default percentages based on typical adult (30-40 years)
    let deepPercent = 0.18;
    let remPercent = 0.22;
    let awakePercent = 0.05;

    if (profile) {
        const age = calculateAge(profile.date_of_birth);

        // Age adjustments (deep sleep decreases with age)
        // Research: Adults lose ~2% deep sleep per decade after 20
        if (age < 25) {
            deepPercent += 0.03;
            remPercent += 0.01;
        } else if (age >= 25 && age < 35) {
            deepPercent += 0.01;
        } else if (age >= 45 && age < 55) {
            deepPercent -= 0.02;
        } else if (age >= 55 && age < 65) {
            deepPercent -= 0.04;
            awakePercent += 0.02;
        } else if (age >= 65) {
            deepPercent -= 0.06;
            awakePercent += 0.03;
        }

        // Sex adjustments (women typically have more REM sleep)
        if (profile.sex === "female") {
            remPercent += 0.02;
            deepPercent -= 0.01;
        }

        // Activity level adjustments
        const activityMult = getActivityMultiplier(profile.activity_level);
        deepPercent *= activityMult;

        // Goal adjustments
        const goalAdj = getGoalAdjustments(profile.goal);
        deepPercent += goalAdj.deepAdj;
        remPercent += goalAdj.remAdj;

        // BMI factor (if we have weight and height)
        if (profile.weight_value && profile.height_value) {
            let heightM: number;
            if (profile.height_unit === "ft") {
                const totalInches = (profile.height_value * 12) +
                    (profile.height_inches || 0);
                heightM = totalInches * 0.0254;
            } else {
                heightM = profile.height_value / 100;
            }

            let weightKg = profile.weight_value;
            if (profile.weight_unit === "lbs") {
                weightKg = profile.weight_value * 0.453592;
            }

            const bmi = weightKg / (heightM * heightM);

            // Higher BMI tends to correlate with more fragmented sleep
            if (bmi > 30) {
                awakePercent += 0.02;
                deepPercent -= 0.02;
            } else if (bmi > 35) {
                awakePercent += 0.03;
                deepPercent -= 0.03;
            }
        }
    }

    // Clamp to reasonable physiological ranges
    deepPercent = clamp(deepPercent, 0.10, 0.28);
    remPercent = clamp(remPercent, 0.15, 0.30);
    awakePercent = clamp(awakePercent, 0.03, 0.12);

    // Light sleep fills the remainder
    const lightPercent = 1 - deepPercent - remPercent - awakePercent;

    return {
        deep: Math.round(durationMinutes * deepPercent),
        rem: Math.round(durationMinutes * remPercent),
        light: Math.round(durationMinutes * clamp(lightPercent, 0.40, 0.65)),
        awake: Math.round(durationMinutes * awakePercent),
    };
}

/**
 * Calculate personalized sleep quality score
 * Takes into account user's profile for optimal targets
 */
export function calculatePersonalizedQuality(
    durationMinutes: number,
    stages: SleepStages,
    profile: UserProfile | null,
): SleepQualityFactors {
    const age = profile ? calculateAge(profile.date_of_birth) : 35;

    // Optimal duration varies by age
    let optimalDuration = 480; // 8 hours default
    if (age < 25) optimalDuration = 510; // Young adults need more
    else if (age >= 65) optimalDuration = 420; // Older adults need less

    // Activity level affects sleep needs
    if (profile?.activity_level === "very_active") {
        optimalDuration += 30;
    } else if (profile?.activity_level === "active") {
        optimalDuration += 15;
    }

    // Duration score (0-100)
    const durationRatio = durationMinutes / optimalDuration;
    let durationScore: number;
    if (durationRatio >= 0.875 && durationRatio <= 1.125) {
        durationScore = 100 - Math.abs(1 - durationRatio) * 40;
    } else if (durationRatio < 0.875) {
        durationScore = Math.max(20, 70 * durationRatio);
    } else {
        durationScore = Math.max(50, 100 - (durationRatio - 1.125) * 60);
    }

    // Deep sleep score (target: 15-20% of total)
    const deepPercent = stages.deep / durationMinutes;
    const deepScore = deepPercent >= 0.15 && deepPercent <= 0.25
        ? 100 - Math.abs(0.20 - deepPercent) * 200
        : Math.max(30, 100 - Math.abs(0.20 - deepPercent) * 300);

    // REM score (target: 20-25% of total)
    const remPercent = stages.rem / durationMinutes;
    const remScore = remPercent >= 0.18 && remPercent <= 0.28
        ? 100 - Math.abs(0.23 - remPercent) * 200
        : Math.max(30, 100 - Math.abs(0.23 - remPercent) * 300);

    // Consistency score placeholder (would use historical data)
    const consistencyScore = 75;

    // Weighted overall score
    const overallScore = Math.round(
        durationScore * 0.35 +
            deepScore * 0.25 +
            remScore * 0.25 +
            consistencyScore * 0.15,
    );

    return {
        durationScore: Math.round(clamp(durationScore, 0, 100)),
        deepScore: Math.round(clamp(deepScore, 0, 100)),
        remScore: Math.round(clamp(remScore, 0, 100)),
        consistencyScore,
        overallScore: clamp(overallScore, 0, 100),
    };
}

/**
 * Calculate quality score from duration when no stage data available
 * More sophisticated than linear calculation
 */
export function calculateQualityFromDuration(
    durationMinutes: number,
    profile: UserProfile | null,
): number {
    const stages = estimateSleepStages(durationMinutes, profile);
    const factors = calculatePersonalizedQuality(
        durationMinutes,
        stages,
        profile,
    );
    return factors.overallScore;
}

/**
 * Learn user's typical sleep patterns from historical data
 * Returns personalized baseline for comparison
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

    // Use last 7 days for pattern analysis
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
