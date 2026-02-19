import type {
  PredictedStageDistribution,
  PremiumSleepPrediction,
  SleepCycleMap,
  SleepPhaseEvent,
} from '@shared';
import { calculateSleepScore } from './sleepAnalysis';

export interface SleepPredictionInput {
  durationMinutes: number;
  startTime: string | null;
  endTime: string | null;
  existingDeepMinutes?: number | null;
  existingRemMinutes?: number | null;
  existingLightMinutes?: number | null;
  existingAwakeMinutes?: number | null;
  estimatedVO2Max: number;
  estimatedRestingHR: number;
  estimatedHRVrmssd: number;
  estimatedRespiratoryRate: number;
  age?: number;
  sex?: 'male' | 'female' | null;
  chronotype?: 'morning' | 'intermediate' | 'evening';
  previousNightDurationMinutes?: number;
  recentSleepDebt?: number;
  recentAvgDeepPercent?: number;
  recentAvgRemPercent?: number;
}

type DistributionDraft = {
  deepPercent: number;
  remPercent: number;
  lightPercent: number;
  awakePercent: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normaliseTo100(draft: DistributionDraft): DistributionDraft {
  const total = draft.deepPercent + draft.remPercent + draft.lightPercent + draft.awakePercent;
  if (total <= 0) {
    return { deepPercent: 18, remPercent: 22, lightPercent: 52, awakePercent: 8 };
  }
  const scale = 100 / total;
  return {
    deepPercent: draft.deepPercent * scale,
    remPercent: draft.remPercent * scale,
    lightPercent: draft.lightPercent * scale,
    awakePercent: draft.awakePercent * scale,
  };
}

function clampAndNormalise(draft: DistributionDraft): DistributionDraft {
  const bounds = {
    deepPercent: { min: 5, max: 35 },
    remPercent: { min: 10, max: 35 },
    lightPercent: { min: 30, max: 60 },
    awakePercent: { min: 2, max: 25 },
  } as const;

  const clamped: DistributionDraft = {
    deepPercent: clamp(draft.deepPercent, bounds.deepPercent.min, bounds.deepPercent.max),
    remPercent: clamp(draft.remPercent, bounds.remPercent.min, bounds.remPercent.max),
    lightPercent: clamp(draft.lightPercent, bounds.lightPercent.min, bounds.lightPercent.max),
    awakePercent: clamp(draft.awakePercent, bounds.awakePercent.min, bounds.awakePercent.max),
  };

  let norm = normaliseTo100(clamped);
  norm = {
    deepPercent: clamp(norm.deepPercent, bounds.deepPercent.min, bounds.deepPercent.max),
    remPercent: clamp(norm.remPercent, bounds.remPercent.min, bounds.remPercent.max),
    lightPercent: clamp(norm.lightPercent, bounds.lightPercent.min, bounds.lightPercent.max),
    awakePercent: clamp(norm.awakePercent, bounds.awakePercent.min, bounds.awakePercent.max),
  };

  // Final residual correction while preserving bounds.
  const keys: Array<keyof DistributionDraft> = [
    'lightPercent',
    'awakePercent',
    'remPercent',
    'deepPercent',
  ];
  let residual =
    100 - (norm.deepPercent + norm.remPercent + norm.lightPercent + norm.awakePercent);

  for (const key of keys) {
    if (Math.abs(residual) < 1e-6) break;
    const b = bounds[key];
    if (residual > 0) {
      const room = b.max - norm[key];
      const add = Math.min(room, residual);
      norm[key] += add;
      residual -= add;
    } else {
      const room = norm[key] - b.min;
      const sub = Math.min(room, Math.abs(residual));
      norm[key] -= sub;
      residual += sub;
    }
  }

  return {
    deepPercent: norm.deepPercent,
    remPercent: norm.remPercent,
    lightPercent: norm.lightPercent,
    awakePercent: norm.awakePercent,
  };
}

function getAgeBaseline(age?: number): DistributionDraft {
  if (age == null) return { deepPercent: 18, remPercent: 22, lightPercent: 52, awakePercent: 8 };
  if (age < 25) return { deepPercent: 22, remPercent: 23, lightPercent: 50, awakePercent: 5 };
  if (age <= 44) return { deepPercent: 18, remPercent: 22, lightPercent: 52, awakePercent: 8 };
  if (age <= 64) return { deepPercent: 14, remPercent: 20, lightPercent: 56, awakePercent: 10 };
  return { deepPercent: 10, remPercent: 18, lightPercent: 60, awakePercent: 12 };
}

function parseLocalHour(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours();
}

function hasRealStageData(input: SleepPredictionInput): boolean {
  const d = input.existingDeepMinutes;
  const r = input.existingRemMinutes;
  const l = input.existingLightMinutes;
  const a = input.existingAwakeMinutes;
  if (d == null || r == null || l == null || a == null) return false;
  const total = d + r + l + a;
  if (input.durationMinutes <= 0) return false;
  return Math.abs(total - input.durationMinutes) / input.durationMinutes <= 0.05;
}

function predictStageDistribution(input: SleepPredictionInput): PredictedStageDistribution {
  const predictionBasis: string[] = [];
  const usedRealData = hasRealStageData(input);

  let dist: DistributionDraft;
  let confidence: PredictedStageDistribution['confidence'] = 'low';

  if (usedRealData) {
    const total = input.durationMinutes || 1;
    dist = {
      deepPercent: ((input.existingDeepMinutes ?? 0) / total) * 100,
      remPercent: ((input.existingRemMinutes ?? 0) / total) * 100,
      lightPercent: ((input.existingLightMinutes ?? 0) / total) * 100,
      awakePercent: ((input.existingAwakeMinutes ?? 0) / total) * 100,
    };
    confidence = 'high';
    predictionBasis.push('existing_stage_data');
  } else {
    dist = getAgeBaseline(input.age);
    predictionBasis.push('age_calibrated_baseline');

    // Step 2: HRV adjustment
    if (input.estimatedHRVrmssd > 55) {
      dist.deepPercent += 4;
      dist.lightPercent -= 4;
      predictionBasis.push('hrv_gt_55');
    } else if (input.estimatedHRVrmssd >= 40) {
      dist.deepPercent += 2;
      dist.lightPercent -= 2;
      predictionBasis.push('hrv_40_55');
    } else if (input.estimatedHRVrmssd < 25) {
      dist.deepPercent -= 4;
      dist.awakePercent += 2;
      dist.lightPercent -= 2;
      predictionBasis.push('hrv_lt_25');
    } else {
      predictionBasis.push('hrv_neutral');
    }

    // Step 3: Resting HR adjustment
    if (input.estimatedRestingHR < 45) {
      dist.deepPercent += 4;
      dist.remPercent += 1;
      predictionBasis.push('resting_hr_lt_45');
    } else if (input.estimatedRestingHR < 50) {
      dist.deepPercent += 3;
      predictionBasis.push('resting_hr_lt_50');
    } else if (input.estimatedRestingHR > 78) {
      dist.deepPercent -= 5;
      dist.awakePercent += 3;
      predictionBasis.push('resting_hr_gt_78');
    } else if (input.estimatedRestingHR > 68) {
      dist.deepPercent -= 3;
      dist.awakePercent += 2;
      predictionBasis.push('resting_hr_gt_68');
    }

    // Step 4: VO2max adjustment
    if (input.estimatedVO2Max > 52) {
      dist.remPercent += 2;
      predictionBasis.push('vo2max_gt_52');
    } else if (input.estimatedVO2Max < 35) {
      dist.remPercent -= 2;
      dist.lightPercent += 2;
      predictionBasis.push('vo2max_lt_35');
    }

    // Step 5: Respiratory rate adjustment
    if (input.estimatedRespiratoryRate >= 12 && input.estimatedRespiratoryRate <= 14) {
      dist.deepPercent += 2;
      predictionBasis.push('rr_12_14');
    } else if (input.estimatedRespiratoryRate > 17) {
      dist.remPercent += 2;
      dist.deepPercent -= 2;
      predictionBasis.push('rr_gt_17');
    }

    // Step 6: Sleep debt rebound
    const debt = input.recentSleepDebt ?? 0;
    if (debt > 240) {
      dist.deepPercent += 8;
      dist.remPercent += 3;
      predictionBasis.push('sleep_debt_gt_240');
    } else if (debt >= 120) {
      dist.deepPercent += 5;
      dist.remPercent += 2;
      predictionBasis.push('sleep_debt_120_240');
    } else if (debt >= 60) {
      dist.deepPercent += 3;
      predictionBasis.push('sleep_debt_60_120');
    }
  }

  // Step 7: Chronotype offset
  if (input.chronotype === 'evening') {
    const startHour = parseLocalHour(input.startTime);
    if (startHour !== null && startHour < 23) {
      dist.remPercent -= 3;
      dist.lightPercent += 3;
      predictionBasis.push('chronotype_evening_early_sleep_penalty');
    }
  } else if (input.chronotype === 'morning') {
    const endHour = parseLocalHour(input.endTime);
    if (endHour !== null && endHour > 8) {
      dist.deepPercent -= 2;
      dist.lightPercent += 2;
      predictionBasis.push('chronotype_morning_late_wake_penalty');
    }
  }

  // Step 8: Personal baseline calibration
  if (input.recentAvgDeepPercent != null) {
    dist.deepPercent = dist.deepPercent * 0.8 + input.recentAvgDeepPercent * 0.2;
    predictionBasis.push('personal_baseline_calibrated');
  }
  if (input.recentAvgRemPercent != null) {
    dist.remPercent = dist.remPercent * 0.8 + input.recentAvgRemPercent * 0.2;
    if (!predictionBasis.includes('personal_baseline_calibrated')) {
      predictionBasis.push('personal_baseline_calibrated');
    }
  }
  dist.lightPercent = 100 - dist.deepPercent - dist.remPercent - dist.awakePercent;

  // Step 9: Confidence upgrade
  if (usedRealData) {
    confidence = 'high';
  } else if (input.recentAvgDeepPercent != null) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Step 10: Clamp & normalise
  const normalized = clampAndNormalise(dist);

  return {
    ...normalized,
    confidence,
    predictionBasis,
  };
}

function generatePhaseTimeline(
  input: SleepPredictionInput,
  dist: PredictedStageDistribution
): SleepCycleMap {
  const totalMinutes = Math.max(1, input.durationMinutes);
  const startMs = input.startTime ? new Date(input.startTime).getTime() : Date.now();
  const fallbackEndMs = startMs + totalMinutes * 60000;
  const parsedEndMs = input.endTime ? new Date(input.endTime).getTime() : fallbackEndMs;
  const endMs = Number.isFinite(parsedEndMs) && parsedEndMs > startMs ? parsedEndMs : fallbackEndMs;

  const estimatedCycles = clamp(Math.round(totalMinutes / 95), 3, 6);
  const phaseTimeline: SleepPhaseEvent[] = [];
  const cycleBreakdown: SleepCycleMap['cycleBreakdown'] = [];

  let currentMs = startMs;
  let usedMinutes = 0;

  let deepRemaining = (totalMinutes * dist.deepPercent) / 100;
  let remRemaining = (totalMinutes * dist.remPercent) / 100;
  let lightRemaining = (totalMinutes * dist.lightPercent) / 100;
  let awakeRemaining = (totalMinutes * dist.awakePercent) / 100;

  const pushPhase = (
    stage: SleepPhaseEvent['stage'],
    durationMinutes: number,
    cycleNumber: number
  ): number => {
    const safeDuration = Math.max(0, durationMinutes);
    if (safeDuration <= 0) return 0;
    const start = new Date(currentMs).toISOString();
    const end = new Date(currentMs + safeDuration * 60000).toISOString();
    phaseTimeline.push({
      stage,
      startTime: start,
      endTime: end,
      durationMinutes: safeDuration,
      cycleNumber,
    });
    currentMs += safeDuration * 60000;
    usedMinutes += safeDuration;
    return safeDuration;
  };

  // Pre-sleep awake phase (SOL)
  let solMinutes = input.estimatedRestingHR > 70 ? 20 : input.estimatedRestingHR > 58 ? 14 : 8;
  solMinutes = clamp(solMinutes, 5, 25);
  solMinutes = Math.min(solMinutes, totalMinutes);
  const emittedSol = pushPhase('awake', solMinutes, 0);
  awakeRemaining = Math.max(0, awakeRemaining - emittedSol);

  const frontCycles = Math.ceil(estimatedCycles / 3);
  const backCycles = Math.floor(estimatedCycles / 3);
  const nonFrontCycles = Math.max(1, estimatedCycles - frontCycles);
  const nonBackCycles = Math.max(1, estimatedCycles - backCycles);

  for (let cycle = 1; cycle <= estimatedCycles; cycle += 1) {
    const cycleTarget = totalMinutes / estimatedCycles;

    const deepPlan =
      cycle <= frontCycles
        ? ((totalMinutes * dist.deepPercent) / 100) * (0.6 / frontCycles)
        : ((totalMinutes * dist.deepPercent) / 100) * (0.4 / nonFrontCycles);

    const backStart = estimatedCycles - backCycles + 1;
    const remPlan =
      cycle >= backStart
        ? ((totalMinutes * dist.remPercent) / 100) * (0.6 / Math.max(1, backCycles))
        : ((totalMinutes * dist.remPercent) / 100) * (0.4 / nonBackCycles);

    const lightDescentPlan = Math.min(lightRemaining, cycleTarget * 0.18);
    const lightAscentPlan = Math.min(Math.max(0, lightRemaining - lightDescentPlan), cycleTarget * 0.18);
    const deepCyclePlan = Math.min(deepRemaining, deepPlan);
    const remCyclePlan = Math.min(remRemaining, remPlan);
    const microAwakePlan = awakeRemaining > 0 ? Math.min(awakeRemaining, awakeRemaining >= 3 ? 3 : 2) : 0;

    const planned = [
      lightDescentPlan,
      deepCyclePlan,
      lightAscentPlan,
      remCyclePlan,
      microAwakePlan,
    ];
    const plannedSum = planned.reduce((s, n) => s + n, 0);
    const cycleScale = plannedSum > cycleTarget ? cycleTarget / plannedSum : 1;
    const [ld, d, la, r, a] = planned.map((n) => n * cycleScale);

    const cycleLight = pushPhase('light', ld, cycle);
    const cycleDeep = pushPhase('deep', d, cycle);
    const cycleLight2 = pushPhase('light', la, cycle);
    const cycleRem = pushPhase('rem', r, cycle);
    const cycleAwake = pushPhase('awake', a, cycle);

    deepRemaining = Math.max(0, deepRemaining - cycleDeep);
    remRemaining = Math.max(0, remRemaining - cycleRem);
    lightRemaining = Math.max(0, lightRemaining - cycleLight - cycleLight2);
    awakeRemaining = Math.max(0, awakeRemaining - cycleAwake);

    const cycleDuration = cycleLight + cycleDeep + cycleLight2 + cycleRem + cycleAwake;
    const cycleStartIndex = phaseTimeline.length - 5;
    const cycleStartTime = phaseTimeline[Math.max(0, cycleStartIndex)]?.startTime ?? new Date(currentMs).toISOString();
    const cycleEndTime = new Date(currentMs).toISOString();
    const dominantStage: 'deep' | 'rem' | 'light' =
      cycleDeep >= cycleRem && cycleDeep >= cycleLight + cycleLight2
        ? 'deep'
        : cycleRem >= cycleLight + cycleLight2
        ? 'rem'
        : 'light';

    cycleBreakdown.push({
      cycleNumber: cycle,
      startTime: cycleStartTime,
      endTime: cycleEndTime,
      durationMinutes: cycleDuration,
      dominantStage,
      deepMinutes: cycleDeep,
      remMinutes: cycleRem,
      lightMinutes: cycleLight + cycleLight2,
      awakeMinutes: cycleAwake,
    });
  }

  const remainingMinutes = totalMinutes - usedMinutes;
  if (remainingMinutes > 0) {
    const finalStage: SleepPhaseEvent['stage'] = lightRemaining >= awakeRemaining ? 'light' : 'awake';
    pushPhase(finalStage, remainingMinutes, estimatedCycles);
  }

  if (phaseTimeline.length > 0) {
    const last = phaseTimeline[phaseTimeline.length - 1];
    last.endTime = new Date(endMs).toISOString();
    const start = new Date(last.startTime).getTime();
    last.durationMinutes = Math.max(0, (endMs - start) / 60000);
  }

  for (let i = 0; i < phaseTimeline.length - 1; i += 1) {
    if (phaseTimeline[i].endTime !== phaseTimeline[i + 1].startTime) {
      throw new Error('Phase timeline invariant violated: detected gap/overlap between events');
    }
  }

  const timelineTotal = phaseTimeline.reduce((sum, e) => sum + e.durationMinutes, 0);
  if (Math.abs(timelineTotal - input.durationMinutes) > 1) {
    throw new Error(
      `Phase timeline invariant violated: total=${timelineTotal.toFixed(2)} target=${input.durationMinutes}`
    );
  }

  return {
    estimatedCycles,
    phaseTimeline,
    cycleBreakdown,
  };
}

function calculateRecoveryIndex(dist: PredictedStageDistribution, input: SleepPredictionInput): number {
  const deepScore = Math.min(100, (dist.deepPercent / 20) * 100) * 0.4;
  const remScore = Math.min(100, (dist.remPercent / 22) * 100) * 0.3;
  const durationScore = Math.min(100, (input.durationMinutes / 480) * 100) * 0.2;
  const debtImpact =
    input.recentSleepDebt != null ? Math.max(0, 100 - input.recentSleepDebt / 4) * 0.1 : 85 * 0.1;
  return Math.round(deepScore + remScore + durationScore + debtImpact);
}

function generateInsightFlags(
  dist: PredictedStageDistribution,
  input: SleepPredictionInput,
  recoveryIndex: number
): string[] {
  const flags: string[] = [];
  if (dist.deepPercent >= 20 && dist.confidence !== 'low') flags.push('OPTIMAL_DEEP');
  if (dist.deepPercent < 12) flags.push('LOW_DEEP');
  if (dist.remPercent > 27) flags.push('REM_REBOUND');
  if (dist.remPercent < 15) flags.push('LOW_REM');
  if (dist.awakePercent > 15) flags.push('HIGH_FRAGMENTATION');
  if ((input.recentSleepDebt ?? 0) > 180) flags.push('SLEEP_DEBT_HIGH');
  if ((input.recentSleepDebt ?? 0) > 120 && recoveryIndex >= 80) flags.push('SLEEP_DEBT_CLEARING');
  if (input.estimatedVO2Max > 52 && dist.confidence !== 'low') flags.push('AEROBIC_ADVANTAGE');
  return flags;
}

export function buildPremiumPrediction(input: SleepPredictionInput): PremiumSleepPrediction {
  const dist = predictStageDistribution(input);
  const cycleMap = generatePhaseTimeline(input, dist);
  const recovery = calculateRecoveryIndex(dist, input);
  const flags = generateInsightFlags(dist, input, recovery);
  const debtMin = input.recentSleepDebt ?? 0;

  const predictedScore = calculateSleepScore({
    current: {
      id: 'premium_prediction',
      date: input.startTime ? new Date(input.startTime).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      durationMinutes: input.durationMinutes,
      deepSleepMinutes: Math.round((input.durationMinutes * dist.deepPercent) / 100),
      remSleepMinutes: Math.round((input.durationMinutes * dist.remPercent) / 100),
      lightSleepMinutes: Math.round((input.durationMinutes * dist.lightPercent) / 100),
      awakeSleepMinutes: Math.round((input.durationMinutes * dist.awakePercent) / 100),
      startTime: input.startTime,
      endTime: input.endTime,
      source: 'premium_prediction',
      confidence: dist.confidence,
      estimatedBedtime: null,
      estimatedWakeup: null,
      screenTimeSummary: null,
    } as any,
    history: [],
    userProfile: { sleepGoalMinutes: 480, age: input.age },
  }).sleepScore;

  return {
    stageDistribution: dist,
    cycleMap,
    estimatedPhysiology: {
      estimatedVO2Max: input.estimatedVO2Max,
      estimatedRestingHR: input.estimatedRestingHR,
      estimatedHRVrmssd: input.estimatedHRVrmssd,
      estimatedHRMax: Math.round(207 - 0.7 * (input.age ?? 35)),
      basisNotes: dist.predictionBasis,
    },
    predictedSleepScore: predictedScore,
    sleepDebtMinutes: debtMin,
    recoveryIndex: recovery,
    insightFlags: flags,
  };
}
