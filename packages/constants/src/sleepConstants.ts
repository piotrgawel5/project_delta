import type { DataSource } from "../../shared/src/types/sleep";

/**
 * Source reliability factors grounded in consumer tracking accuracy vs PSG.
 * Wearables with PPG+accelerometer perform best; inferred sources are lower-reliability.
 */
export const SOURCE_RELIABILITY: Record<
  DataSource,
  { factor: number; stageDataValid: boolean }
> = {
  wearable: { factor: 1.0, stageDataValid: true },
  health_connect: { factor: 0.95, stageDataValid: true },
  manual: { factor: 0.85, stageDataValid: false },
  digital_wellbeing: { factor: 0.7, stageDataValid: false },
  usage_stats: { factor: 0.65, stageDataValid: false },
};

/**
 * Base component allocation before dynamic reweighting and normalization.
 */
export const BASE_COMPONENT_WEIGHTS = {
  duration: 0.28,
  deepSleep: 0.18,
  remSleep: 0.18,
  efficiency: 0.14,
  waso: 0.1,
  consistency: 0.08,
  timing: 0.04,
  screenTime: 0.02,
} as const;

/**
 * Completeness penalties:
 * -10% per missing stage field, -5% if timing endpoints are missing, with 0.6 floor.
 */
export const COMPLETENESS = {
  missingStagePenalty: 0.1,
  missingTimePenalty: 0.05,
  minFactor: 0.6,
} as const;

/**
 * Baseline blend proportions. Personal baseline gets more weight than population norms.
 */
export const BASELINE_BLEND = {
  personal: 0.6,
  population: 0.4,
} as const;

/**
 * Age/chronotype dynamic weight shifts informed by age-related architecture changes and SJL.
 */
export const DYNAMIC_WEIGHT_ADJUSTMENTS = {
  ageOver50: {
    deepSleepPlus: 0.04,
    efficiencyMinus: 0.02,
    wasoPlus: 0.02,
  },
  eveningChronotype: {
    remPlus: 0.03,
    consistencyPlus: 0.02,
    timingPlus: 0.02,
  },
  durationNearGoal: {
    durationMinus: 0.06,
    efficiencyPlus: 0.03,
    deepPlus: 0.02,
    remPlus: 0.01,
  },
  shortSleep: {
    thresholdMin: 300,
    durationPlus: 0.08,
    efficiencyMinus: 0.04,
    wasoMinus: 0.04,
  },
  consistencyLowHistory: {
    thresholdNights: 5,
    keepRatio: 0.1,
    redistributeDuration: 0.5,
    redistributeEfficiency: 0.5,
  },
  consistencyHighHistory: {
    thresholdNights: 14,
    consistencyPlus: 0.02,
    timingPlus: 0.01,
  },
} as const;

/**
 * Gaussian/sigmoid widths tuned to sleep physiology asymmetry:
 * under-sleep and low restorative stages are costlier than slight overshoot.
 */
export const GAUSSIAN_SIGMA = {
  durationBelow: 60,
  durationAbove: 90,
  deepBelow: 4,
  deepAbove: 6,
  remBelow: 4.5,
  remBelowEveningChronotype: 3.5,
  remAbove: 6,
  efficiencyBelow: 0.07,
  efficiencyAbove: 0.05,
  consistencyMinutes: 60,
  timingMinutes: 70,
} as const;

/**
 * WASO knee-point is age-adjusted; 20m is clinical young-adult guidance.
 */
export const WASO = {
  severeMinutes: 60,
  baselineTailTarget: 0.3,
  relativeFloor: 0,
} as const;

/**
 * Chronic debt (Two-Process proxy) capped at 12% drag, requiring multiple nights to clear.
 */
export const CHRONIC_DEBT = {
  recentWindowNights: 7,
  minHistoryNights: 3,
  maxPenalty: 0.12,
  deficitScale: 0.5,
} as const;

/**
 * Explicit post-aggregation age correction for efficiency expectations after 40.
 */
export const AGE_EFFICIENCY_CORRECTION = {
  ageStart: 40,
  pointsPerYear: 0.15,
  maxCorrectionPoints: 5,
} as const;

/**
 * Confidence shrinkage toward prior mean for uncertainty control.
 */
export const SHRINKAGE = {
  priorMean: 50,
  lowConfidenceExtraFactor: 0.9,
} as const;

/**
 * Timing and flag thresholds for interpretable outputs.
 */
export const FLAGS = {
  durationBelow5h: 300,
  goalDurationLowRatio: 0.8,
  deepLowRatio: 0.15,
  remLowRatio: 0.15,
  awakeTstHighRatio: 0.1,
  bedtimeDeviationWarningMinutes: 90,
  bedtimeDeviationSevereMinutes: 180,
  socialJetLagVarianceMinutes: 90,
} as const;

/**
 * Neutral fallback component score used when data is absent but non-fatal.
 */
export const NEUTRAL_COMPONENT_SCORE = 0.5;

/**
 * Default sleep goal used when user-level target is missing.
 */
export const DEFAULT_SLEEP_GOAL_MINUTES = 480;

/**
 * Age norms from AASM guidance + Ohayon et al. meta-analysis trend anchors.
 */
export const AGE_NORMS = {
  under18: {
    idealDurationMin: 540,
    minHealthyDurationMin: 480,
    deepPctIdeal: 22,
    deepPctLow: 17,
    deepPctHigh: 28,
    remPctIdeal: 22,
    remPctLow: 17,
    remPctHigh: 28,
    efficiencyIdeal: 0.93,
    efficiencyLow: 0.85,
    wasoExpected: 15,
    wasoAcceptable: 20,
  },
  "18-25": {
    idealDurationMin: 490,
    minHealthyDurationMin: 420,
    deepPctIdeal: 20,
    deepPctLow: 16,
    deepPctHigh: 25,
    remPctIdeal: 22,
    remPctLow: 17,
    remPctHigh: 27,
    efficiencyIdeal: 0.92,
    efficiencyLow: 0.85,
    wasoExpected: 18,
    wasoAcceptable: 20,
  },
  "26-35": {
    idealDurationMin: 460,
    minHealthyDurationMin: 420,
    deepPctIdeal: 18,
    deepPctLow: 14,
    deepPctHigh: 23,
    remPctIdeal: 21,
    remPctLow: 16,
    remPctHigh: 26,
    efficiencyIdeal: 0.91,
    efficiencyLow: 0.85,
    wasoExpected: 22,
    wasoAcceptable: 25,
  },
  "36-50": {
    idealDurationMin: 450,
    minHealthyDurationMin: 420,
    deepPctIdeal: 15,
    deepPctLow: 11,
    deepPctHigh: 20,
    remPctIdeal: 20,
    remPctLow: 15,
    remPctHigh: 25,
    efficiencyIdeal: 0.88,
    efficiencyLow: 0.82,
    wasoExpected: 32,
    wasoAcceptable: 40,
  },
  "51-65": {
    idealDurationMin: 440,
    minHealthyDurationMin: 420,
    deepPctIdeal: 13,
    deepPctLow: 9,
    deepPctHigh: 17,
    remPctIdeal: 19,
    remPctLow: 14,
    remPctHigh: 24,
    efficiencyIdeal: 0.85,
    efficiencyLow: 0.79,
    wasoExpected: 42,
    wasoAcceptable: 55,
  },
  "65plus": {
    idealDurationMin: 420,
    minHealthyDurationMin: 390,
    deepPctIdeal: 11,
    deepPctLow: 7,
    deepPctHigh: 15,
    remPctIdeal: 17,
    remPctLow: 12,
    remPctHigh: 22,
    efficiencyIdeal: 0.82,
    efficiencyLow: 0.75,
    wasoExpected: 52,
    wasoAcceptable: 70,
  },
} as const;
