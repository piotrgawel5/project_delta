// lib/sleepAnalysis.ts
// Generates plain-text analysis for weekly and monthly sleep summaries
// Will be replaced with OpenAI API integration later

interface DaySleepData {
    date: string;
    durationHours: number;
    quality: number;
    deepMin: number;
    remMin: number;
    lightMin: number;
    awakeMin: number;
    startTime?: string;
    endTime?: string;
}

export interface WeeklySummary {
    totalHours: number;
    avgHours: number;
    avgQuality: number;
    bestDay: { day: string; hours: number } | null;
    worstDay: { day: string; hours: number } | null;
    daysWithGoodSleep: number;
    avgDeepPercent: number;
    avgRemPercent: number;
    consistencyScore: number;
    insights: string[];
    mainInsight: string;
}

export interface MonthlySummary {
    totalHours: number;
    avgHours: number;
    avgQuality: number;
    daysTracked: number;
    daysWithGoodSleep: number;
    avgDeepPercent: number;
    avgRemPercent: number;
    consistencyScore: number;
    weeklyAverages: number[];
    insights: string[];
    mainInsight: string;
}

/**
 * Calculate standard deviation for consistency scoring
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
 * Convert consistency (low std dev = high score)
 */
function consistencyFromStdDev(stdDev: number): number {
    // 0 hours std dev = 100%, 3+ hours std dev = 0%
    const maxStd = 3;
    return Math.round(Math.max(0, Math.min(100, (1 - stdDev / maxStd) * 100)));
}

/**
 * Get day name from date string
 */
function getDayName(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "long" });
}

/**
 * Generate weekly sleep summary with insights
 */
export function generateWeeklySummary(weekData: DaySleepData[]): WeeklySummary {
    const validDays = weekData.filter((d) => d.durationHours > 0);

    if (validDays.length === 0) {
        return {
            totalHours: 0,
            avgHours: 0,
            avgQuality: 0,
            bestDay: null,
            worstDay: null,
            daysWithGoodSleep: 0,
            avgDeepPercent: 0,
            avgRemPercent: 0,
            consistencyScore: 0,
            insights: ["No sleep data available for this week."],
            mainInsight:
                "Start tracking your sleep to get personalized insights.",
        };
    }

    const totalHours = validDays.reduce((sum, d) => sum + d.durationHours, 0);
    const avgHours = totalHours / validDays.length;
    const avgQuality = validDays.reduce((sum, d) => sum + d.quality, 0) /
        validDays.length;

    // Find best and worst days
    const sorted = [...validDays].sort((a, b) =>
        b.durationHours - a.durationHours
    );
    const bestDay = sorted[0]
        ? { day: getDayName(sorted[0].date), hours: sorted[0].durationHours }
        : null;
    const worstDay = sorted[sorted.length - 1]
        ? {
            day: getDayName(sorted[sorted.length - 1].date),
            hours: sorted[sorted.length - 1].durationHours,
        }
        : null;

    // Count good sleep days (7+ hours)
    const daysWithGoodSleep =
        validDays.filter((d) => d.durationHours >= 7).length;

    // Calculate sleep stage averages
    const totalSleepMin = validDays.reduce(
        (sum, d) => sum + d.durationHours * 60,
        0,
    );
    const totalDeep = validDays.reduce((sum, d) => sum + d.deepMin, 0);
    const totalRem = validDays.reduce((sum, d) => sum + d.remMin, 0);
    const avgDeepPercent = totalSleepMin > 0
        ? Math.round((totalDeep / totalSleepMin) * 100)
        : 0;
    const avgRemPercent = totalSleepMin > 0
        ? Math.round((totalRem / totalSleepMin) * 100)
        : 0;

    // Consistency score
    const durations = validDays.map((d) => d.durationHours);
    const stdDev = calculateStdDev(durations);
    const consistencyScore = consistencyFromStdDev(stdDev);

    // Generate insights
    const insights: string[] = [];
    let mainInsight = "";

    // Duration insight
    if (avgHours >= 7.5) {
        insights.push(
            "Excellent sleep duration this week! You're meeting the recommended 7-9 hours.",
        );
        mainInsight = "Great week for sleep! Your average of " +
            avgHours.toFixed(1) + " hours is optimal.";
    } else if (avgHours >= 6.5) {
        insights.push(
            "Your sleep duration is adequate but could be improved. Aim for 7-8 hours.",
        );
        mainInsight =
            "Good progress, but try to add 30-60 more minutes of sleep per night.";
    } else {
        insights.push(
            "You're not getting enough sleep. This can affect your energy, mood, and health.",
        );
        mainInsight = "Sleep debt alert! Averaging only " +
            avgHours.toFixed(1) + " hours. Prioritize rest.";
    }

    // Consistency insight
    if (consistencyScore >= 80) {
        insights.push(
            "Your sleep schedule is very consistent, which helps maintain a healthy circadian rhythm.",
        );
    } else if (consistencyScore >= 50) {
        insights.push(
            "Your sleep times vary moderately. Try to go to bed at the same time each night.",
        );
    } else {
        insights.push(
            "Your sleep schedule is irregular. This can disrupt your body clock and reduce sleep quality.",
        );
    }

    // Deep sleep insight
    if (avgDeepPercent < 13) {
        insights.push(
            "Your deep sleep is below optimal (target: 15-20%). Avoid alcohol and screens before bed.",
        );
    } else if (avgDeepPercent >= 18) {
        insights.push(
            "Excellent deep sleep! This indicates good physical recovery.",
        );
    }

    // Weekend vs weekday (if we have enough data)
    const weekendDays = validDays.filter((d) => {
        const day = new Date(d.date).getDay();
        return day === 0 || day === 6;
    });
    const weekdayDays = validDays.filter((d) => {
        const day = new Date(d.date).getDay();
        return day !== 0 && day !== 6;
    });

    if (weekendDays.length > 0 && weekdayDays.length > 0) {
        const weekendAvg = weekendDays.reduce((s, d) =>
            s + d.durationHours, 0) / weekendDays.length;
        const weekdayAvg = weekdayDays.reduce((s, d) =>
            s + d.durationHours, 0) / weekdayDays.length;
        const diff = Math.abs(weekendAvg - weekdayAvg);

        if (diff > 1.5) {
            insights.push(
                'Large difference between weekend and weekday sleep. This "social jet lag" can affect your energy.',
            );
        }
    }

    return {
        totalHours: Math.round(totalHours * 10) / 10,
        avgHours: Math.round(avgHours * 10) / 10,
        avgQuality: Math.round(avgQuality),
        bestDay,
        worstDay,
        daysWithGoodSleep,
        avgDeepPercent,
        avgRemPercent,
        consistencyScore,
        insights: insights.slice(0, 3), // Max 3 insights
        mainInsight,
    };
}

/**
 * Generate monthly sleep summary with insights
 */
export function generateMonthlySummary(
    monthData: DaySleepData[],
): MonthlySummary {
    const validDays = monthData.filter((d) => d.durationHours > 0);

    if (validDays.length === 0) {
        return {
            totalHours: 0,
            avgHours: 0,
            avgQuality: 0,
            daysTracked: 0,
            daysWithGoodSleep: 0,
            avgDeepPercent: 0,
            avgRemPercent: 0,
            consistencyScore: 0,
            weeklyAverages: [],
            insights: ["No sleep data available for this month."],
            mainInsight: "Start tracking your sleep to get monthly insights.",
        };
    }

    const totalHours = validDays.reduce((sum, d) => sum + d.durationHours, 0);
    const avgHours = totalHours / validDays.length;
    const avgQuality = validDays.reduce((sum, d) => sum + d.quality, 0) /
        validDays.length;
    const daysWithGoodSleep =
        validDays.filter((d) => d.durationHours >= 7).length;

    // Calculate sleep stage averages
    const totalSleepMin = validDays.reduce(
        (sum, d) => sum + d.durationHours * 60,
        0,
    );
    const totalDeep = validDays.reduce((sum, d) => sum + d.deepMin, 0);
    const totalRem = validDays.reduce((sum, d) => sum + d.remMin, 0);
    const avgDeepPercent = totalSleepMin > 0
        ? Math.round((totalDeep / totalSleepMin) * 100)
        : 0;
    const avgRemPercent = totalSleepMin > 0
        ? Math.round((totalRem / totalSleepMin) * 100)
        : 0;

    // Consistency score
    const durations = validDays.map((d) => d.durationHours);
    const stdDev = calculateStdDev(durations);
    const consistencyScore = consistencyFromStdDev(stdDev);

    // Weekly averages (group by week)
    const weeklyAverages: number[] = [];
    for (let i = 0; i < validDays.length; i += 7) {
        const weekSlice = validDays.slice(i, i + 7);
        const weekAvg = weekSlice.reduce((s, d) => s + d.durationHours, 0) /
            weekSlice.length;
        weeklyAverages.push(Math.round(weekAvg * 10) / 10);
    }

    // Generate insights
    const insights: string[] = [];
    let mainInsight = "";

    // Overall assessment
    const goalAchievement = Math.round(
        (daysWithGoodSleep / validDays.length) * 100,
    );

    if (goalAchievement >= 80) {
        insights.push(
            `Excellent month! You hit your 7+ hour goal ${goalAchievement}% of tracked nights.`,
        );
        mainInsight = "Outstanding sleep consistency this month. Keep it up!";
    } else if (goalAchievement >= 60) {
        insights.push(
            `Good effort! You achieved 7+ hours on ${goalAchievement}% of nights.`,
        );
        mainInsight =
            "Solid month overall. A few more good nights would make it great.";
    } else {
        insights.push(
            `Room for improvement: Only ${goalAchievement}% of nights met the 7-hour goal.`,
        );
        mainInsight =
            "This month's sleep needs attention. Consider adjusting your schedule.";
    }

    // Trend insight
    if (weeklyAverages.length >= 2) {
        const firstWeek = weeklyAverages[0];
        const lastWeek = weeklyAverages[weeklyAverages.length - 1];
        const trend = lastWeek - firstWeek;

        if (trend > 0.5) {
            insights.push(
                "Positive trend: Your sleep duration improved over the month.",
            );
        } else if (trend < -0.5) {
            insights.push(
                "Declining trend: Your sleep duration decreased as the month went on.",
            );
        }
    }

    // Quality insight
    if (avgQuality >= 80) {
        insights.push(
            "High sleep quality throughout the month indicates restful, restorative sleep.",
        );
    } else if (avgQuality < 60) {
        insights.push(
            "Sleep quality could be improved. Consider your sleep environment and pre-bed routine.",
        );
    }

    // Deep sleep recommendation
    if (avgDeepPercent < 15) {
        insights.push(
            "Deep sleep is below optimal. Regular exercise (not too close to bedtime) can help.",
        );
    }

    return {
        totalHours: Math.round(totalHours),
        avgHours: Math.round(avgHours * 10) / 10,
        avgQuality: Math.round(avgQuality),
        daysTracked: validDays.length,
        daysWithGoodSleep,
        avgDeepPercent,
        avgRemPercent,
        consistencyScore,
        weeklyAverages,
        insights: insights.slice(0, 4), // Max 4 insights
        mainInsight,
    };
}

/**
 * Format hours nicely
 */
export function formatHoursShort(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
}
