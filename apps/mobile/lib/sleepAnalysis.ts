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

function scoreScreenTime(summary: SleepRecord['screenTimeSummary']): number {
  if (!summary) return NEUTRAL_COMPONENT_SCORE;
  const mins = summary.totalMinutesLast2Hours ?? 0;
  return clamp(1 / (1 + Math.exp(0.04 * (mins - 40))));
}

function computeChronicDebtPenalty(history: SleepRecord[], goalMinutes: number): number {
  const recent = history
    .slice(0, CHRONIC_DEBT.recentWindowNights)
    .filter((record) => (record.durationMinutes ?? 0) > 0);
  if (recent.length < CHRONIC_DEBT.minHistoryNights) return 0;
  const avgTst =
    recent.reduce((sum, record) => sum + (record.durationMinutes ?? 0), 0) / recent.length;
  const deficitRatio = Math.max(0, (goalMinutes - avgTst) / goalMinutes);
  return Math.min(deficitRatio * CHRONIC_DEBT.deficitScale, CHRONIC_DEBT.maxPenalty);
}

function computeFlags(
  record: SleepRecord,
  tst: number,
  norm: AgeNorm,
  baseline: UserBaseline,
  goalMinutes: number
): string[] {
  const flags: string[] = [];
  const deep = record.deepSleepMinutes ?? 0;
  const rem = record.remSleepMinutes ?? 0;
  const waso = record.awakeSleepMinutes ?? 0;

  if (tst < FLAGS.durationBelow5h) flags.push('duration_below_5h');
  if (tst < goalMinutes * FLAGS.goalDurationLowRatio) {
    flags.push('duration_below_goal_20pct');
  }
  if (tst > 0 && deep > 0 && deep / tst < FLAGS.deepLowRatio) {
    flags.push('deep_below_15pct');
  }
  if (tst > 0 && rem > 0 && rem / tst < FLAGS.remLowRatio) {
    flags.push('rem_below_15pct');
  }
  if (tst > 0 && waso > 0 && waso / tst > FLAGS.awakeTstHighRatio) {
    flags.push('awake_above_10pct_tst');
  }

  if (waso > norm.wasoAcceptable) flags.push('waso_above_acceptable');
  if (waso > WASO.severeMinutes) flags.push('waso_severe');

  if (baseline.nightsAnalysed >= 5) {
    const bedtime = parseMinutesFromMidnight(record.startTime);
    if (bedtime !== null) {
      const deviation = Math.abs(bedtime - baseline.medianBedtimeMinutesFromMidnight);
      if (deviation > FLAGS.bedtimeDeviationWarningMinutes) {
        flags.push('late_bedtime_vs_median');
      }
      if (deviation > FLAGS.bedtimeDeviationSevereMinutes) {
        flags.push('extreme_bedtime_shift');
      }
    }
    if (baseline.bedtimeVarianceMinutes > FLAGS.socialJetLagVarianceMinutes) {
      flags.push('social_jet_lag');
    }
  }

  if (!record.deepSleepMinutes || !record.remSleepMinutes) {
    flags.push('data_incomplete_stages');
  }

  if (record.source === 'usage_stats' || record.source === 'digital_wellbeing') {
    flags.push('source_low_reliability');
  }

  return flags;
}

function buildComponentResults(
  current: SleepRecord,
  normalizedComponents: ComponentScores,
  weights: DynamicWeights,
  norm: AgeNorm,
  baseline: UserBaseline
): ScoreBreakdown['components'] {
  const tst = current.durationMinutes ?? 0;
  const stageTotal = tst > 0 ? tst : 1;
  const dse =
    current.startTime && current.endTime
      ? (new Date(current.endTime).getTime() - new Date(current.startTime).getTime()) / 60000
      : tst + (current.awakeSleepMinutes ?? 0);

  const durationTarget =
    BASELINE_BLEND.personal * (baseline.avgDurationMin || norm.idealDurationMin) +
    BASELINE_BLEND.population * norm.idealDurationMin;
  const deepTarget =
    BASELINE_BLEND.personal * (baseline.avgDeepPct || norm.deepPctIdeal) +
    BASELINE_BLEND.population * norm.deepPctIdeal;
  const remTarget =
    BASELINE_BLEND.personal * (baseline.avgRemPct || norm.remPctIdeal) +
    BASELINE_BLEND.population * norm.remPctIdeal;
  const efficiencyTarget =
    BASELINE_BLEND.personal * (baseline.avgEfficiency || norm.efficiencyIdeal) +
    BASELINE_BLEND.population * norm.efficiencyIdeal;
  const wasoTarget =
    BASELINE_BLEND.personal * (baseline.avgWasoMin || norm.wasoExpected) +
    BASELINE_BLEND.population * norm.wasoExpected;

  const build = (key: ComponentKey, raw: number, normValue: number): ComponentResult => ({
    raw,
    norm: normValue,
    normalised: normalizedComponents[key],
    weight: weights[key],
    contribution: weights[key] * normalizedComponents[key] * 100,
  });

  return {
    duration: build('duration', tst, durationTarget),
    deepSleep: build('deepSleep', ((current.deepSleepMinutes ?? 0) / stageTotal) * 100, deepTarget),
    remSleep: build('remSleep', ((current.remSleepMinutes ?? 0) / stageTotal) * 100, remTarget),
    efficiency: build('efficiency', dse > 0 ? tst / dse : 0, efficiencyTarget),
    waso: build('waso', current.awakeSleepMinutes ?? 0, wasoTarget),
    consistency: build(
      'consistency',
      current.startTime
        ? Math.abs(
            (parseMinutesFromMidnight(current.startTime) ?? 0) -
              baseline.medianBedtimeMinutesFromMidnight
          )
        : 0,
      baseline.bedtimeVarianceMinutes
    ),
    timing: build(
      'timing',
      parseMinutesFromMidnight(current.startTime) ?? 0,
      baseline.medianBedtimeMinutesFromMidnight
    ),
    screenTime: build('screenTime', current.screenTimeSummary?.totalMinutesLast2Hours ?? 0, 40),
  };
}

function buildZeroResult(now: Date): { sleepScore: number; scoreBreakdown: ScoreBreakdown } {
  const zeroWeights: DynamicWeights = {
    duration: 1,
    deepSleep: 0,
    remSleep: 0,
    efficiency: 0,
    waso: 0,
    consistency: 0,
    timing: 0,
    screenTime: 0,
  };
  const zeroComponent: ComponentResult = {
    raw: 0,
    norm: 0,
    normalised: 0,
    weight: 0,
    contribution: 0,
  };
  const baseline: UserBaseline = {
    avgDurationMin: 0,
    avgDeepPct: 0,
    avgRemPct: 0,
    avgEfficiency: 0,
    avgWasoMin: 0,
    medianBedtimeMinutesFromMidnight: 0,
    medianWakeMinutesFromMidnight: 0,
    bedtimeVarianceMinutes: 0,
    p25DurationMin: 0,
    p75DurationMin: 0,
    nightsAnalysed: 0,
  };
  const ageNorm = getAgeNorm();

  return {
    sleepScore: 0,
    scoreBreakdown: {
      score: 0,
      confidence: 'low',
      components: {
        duration: { ...zeroComponent, weight: 1 },
        deepSleep: zeroComponent,
        remSleep: zeroComponent,
        efficiency: zeroComponent,
        waso: zeroComponent,
        consistency: zeroComponent,
        timing: zeroComponent,
        screenTime: zeroComponent,
      },
      weights: zeroWeights,
      adjustments: {
        sourceReliabilityFactor: SOURCE_RELIABILITY.manual.factor,
        dataCompletenessFactor: COMPLETENESS.minFactor,
        chronicDebtPenalty: 0,
        ageEfficiencyCorrection: 0,
        chronotypeAlignmentDelta: 0,
      },
      baseline,
      ageNorm,
      flags: ['data_incomplete', 'data_incomplete_stages'],
      calculatedAt: now.toISOString(),
    },
  };
}

export function calculateSleepScore(
  input: SleepScoringInput,
  now: Date = new Date()
): { sleepScore: number; scoreBreakdown: ScoreBreakdown } {
  const { current, history, userProfile = {} } = input;
  const tst = current.durationMinutes ?? 0;
  if (tst <= 0) return buildZeroResult(now);

  const ageNorm = getAgeNorm(userProfile.age);
  const baseline = computeBaseline(history);
  const completeness = assessCompleteness(current);
  const sourceInfo = SOURCE_RELIABILITY[current.source as DataSource] ?? SOURCE_RELIABILITY.manual;
  const sleepGoalMinutes = userProfile.sleepGoalMinutes ?? DEFAULT_SLEEP_GOAL_MINUTES;

  const timeInBed = (() => {
    if (current.startTime && current.endTime) {
      const startMs = new Date(current.startTime).getTime();
      const endMs = new Date(current.endTime).getTime();
      const diff = (endMs - startMs) / 60000;
      if (Number.isFinite(diff) && diff > 0) return diff;
    }
    return tst * 1.08;
  })();

  const efficiencyRatio = timeInBed > 0 ? tst / timeInBed : 0;
  const efficiencyPct = efficiencyRatio * 100;
  const efficiencyScore =
    efficiencyPct >= 90
      ? 100
      : efficiencyPct >= 85
      ? 80
      : efficiencyPct >= 80
      ? 60
      : Math.max(0, (efficiencyPct / 80) * 60);

  const age = userProfile.age;
  const targetDeepPct =
    age == null ? 18 : age < 25 ? 22 : age <= 44 ? 18 : age <= 64 ? 14 : 10;
  const targetRemPct =
    age == null ? 22 : age < 25 ? 23 : age <= 44 ? 22 : age <= 64 ? 20 : 18;

  const deepPct = tst > 0 ? ((current.deepSleepMinutes ?? 0) / tst) * 100 : 0;
  const remPct = tst > 0 ? ((current.remSleepMinutes ?? 0) / tst) * 100 : 0;

  const scoreStageBand = (actualPct: number, targetPct: number): number => {
    const low = targetPct - 2.5;
    const high = targetPct + 2.5;
    if (actualPct >= low && actualPct <= high) return 100;
    const delta = actualPct < low ? low - actualPct : actualPct - high;
    return Math.max(0, 100 - (delta / 15) * 100);
  };

  const deepScore = scoreStageBand(deepPct, targetDeepPct);
  const remScore = scoreStageBand(remPct, targetRemPct);

  const wasoMinutes =
    current.awakeSleepMinutes != null
      ? current.awakeSleepMinutes
      : Math.max(0, timeInBed - tst);
  const wasoScore =
    wasoMinutes < 15 ? 100 : wasoMinutes >= 60 ? 0 : ((60 - wasoMinutes) / 45) * 100;

  const tstHours = tst / 60;
  const tstScore =
    tstHours >= 7 && tstHours <= 9
      ? 100
      : (tstHours >= 6 && tstHours < 7) || (tstHours > 9 && tstHours <= 10)
      ? 80
      : (tstHours >= 5 && tstHours < 6) || (tstHours > 10 && tstHours <= 11)
      ? 50
      : 20;

  // Keep existing regularity scoring logic.
  const regularityScore = scoreConsistency(current, baseline) * 100;

  const weights: DynamicWeights = {
    duration: 0.1,
    deepSleep: 0.2,
    remSleep: 0.2,
    efficiency: 0.25,
    waso: 0.15,
    consistency: 0.1,
    timing: 0,
    screenTime: 0,
  };

  const components: ComponentScores = {
    duration: clamp(tstScore / 100),
    deepSleep: clamp(deepScore / 100),
    remSleep: clamp(remScore / 100),
    efficiency: clamp(efficiencyScore / 100),
    waso: clamp(wasoScore / 100),
    consistency: clamp(regularityScore / 100),
    timing: 0,
    screenTime: 0,
  };

  const rawScore = (Object.keys(weights) as ComponentKey[]).reduce((sum, key) => {
    return sum + weights[key] * components[key] * 100;
  }, 0);

  const chronicDebtPenalty = computeChronicDebtPenalty(history, sleepGoalMinutes) * 100;
  const shortSleepPenalty =
    tstHours < 5 ? 35 + (5 - tstHours) * 5 : tstHours < 6 ? 10 + (6 - tstHours) * 5 : 0;
  const adjustedForPenalties = rawScore - shortSleepPenalty - chronicDebtPenalty;
  const reliabilityAdjusted = 50 + (adjustedForPenalties - 50) * sourceInfo.factor;
  const completenessAdjusted = reliabilityAdjusted * completeness.factor;
  const finalScore = Math.round(clamp(completenessAdjusted, 0, 100));

  const flags = computeFlags(current, tst, ageNorm, baseline, sleepGoalMinutes);

  const outputConfidence: ConfidenceLevel =
    !completeness.hasStages && !sourceInfo.stageDataValid
      ? 'low'
      : current.confidence === 'high' && sourceInfo.factor >= 0.9
        ? 'high'
        : 'medium';

  const scoreBreakdown: ScoreBreakdown = {
    score: finalScore,
    confidence: outputConfidence,
    efficiencyScore: Math.round(clamp(efficiencyScore, 0, 100)),
    wasoScore: Math.round(clamp(wasoScore, 0, 100)),
    tstScore: Math.round(clamp(tstScore, 0, 100)),
    deepScore: Math.round(clamp(deepScore, 0, 100)),
    remScore: Math.round(clamp(remScore, 0, 100)),
    regularityScore: Math.round(clamp(regularityScore, 0, 100)),
    components: buildComponentResults(current, components, weights, ageNorm, baseline),
    weights,
    adjustments: {
      sourceReliabilityFactor: sourceInfo.factor,
      dataCompletenessFactor: completeness.factor,
      chronicDebtPenalty: Math.round(chronicDebtPenalty * 100) / 100,
      ageEfficiencyCorrection: 0,
      chronotypeAlignmentDelta: 0,
    },
    baseline,
    ageNorm,
    flags,
    calculatedAt: now.toISOString(),
  };

  return { sleepScore: finalScore, scoreBreakdown };
}
