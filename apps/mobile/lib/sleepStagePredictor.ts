import type {
  PremiumSleepPrediction,
  PredictedStageDistribution,
  SleepCycleMap,
  SleepPhaseEvent,
  CycleBreakdown,
} from '@shared';
import { calculateSleepScore } from '@lib/sleepAnalysis';

// ------------------------------------------------------------------
// Input type
// ------------------------------------------------------------------

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

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalize(dist: {
  deep: number;
  rem: number;
  light: number;
  awake: number;
}): { deep: number; rem: number; light: number; awake: number } {
  // Clamp first
  const awake = clamp(dist.awake, 2, 25);
  const light = clamp(dist.light, 30, 60);
  const deep  = clamp(dist.deep,  5, 35);
  const rem   = clamp(dist.rem,  10, 35);
  const total = awake + light + deep + rem;
  const factor = 100 / total;
  return {
    deep:  Math.round(deep * factor * 10) / 10,
    rem:   Math.round(rem  * factor * 10) / 10,
    light: Math.round(light * factor * 10) / 10,
    awake: Math.round(awake * factor * 10) / 10,
  };
}

// ------------------------------------------------------------------
// Age-calibrated baselines
// ------------------------------------------------------------------

function ageBaseline(age?: number): { deep: number; rem: number; light: number; awake: number } {
  const a = age ?? 35;
  if (a < 25)  return { deep: 22, rem: 23, light: 50, awake: 5 };
  if (a < 45)  return { deep: 18, rem: 22, light: 52, awake: 8 };
  if (a < 65)  return { deep: 14, rem: 20, light: 56, awake: 10 };
  return         { deep: 10, rem: 18, light: 60, awake: 12 };
}

// ------------------------------------------------------------------
// Stage distribution prediction
// ------------------------------------------------------------------

export function predictStageDistribution(input: SleepPredictionInput): PredictedStageDistribution {
  const predictionBasis: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // Check if real stage data exists and is coherent
  const sumExisting =
    (input.existingDeepMinutes ?? 0) +
    (input.existingRemMinutes ?? 0) +
    (input.existingLightMinutes ?? 0) +
    (input.existingAwakeMinutes ?? 0);

  const hasRealData =
    input.existingDeepMinutes != null &&
    input.existingRemMinutes != null &&
    input.existingLightMinutes != null &&
    input.existingAwakeMinutes != null &&
    Math.abs(sumExisting - input.durationMinutes) <= input.durationMinutes * 0.05;

  if (hasRealData) {
    const deep  = (input.existingDeepMinutes!  / input.durationMinutes) * 100;
    const rem   = (input.existingRemMinutes!   / input.durationMinutes) * 100;
    const light = (input.existingLightMinutes! / input.durationMinutes) * 100;
    const awake = (input.existingAwakeMinutes! / input.durationMinutes) * 100;
    predictionBasis.push('real_stage_data');
    // Still apply step 7 (chronotype) on top of real data
    let d = { deep, rem, light, awake };
    d = applyChronotype(d, input, predictionBasis);
    const normed = normalize(d);
    return {
      deepPercent:  normed.deep,
      remPercent:   normed.rem,
      lightPercent: normed.light,
      awakePercent: normed.awake,
      confidence:   'high',
      predictionBasis,
    };
  }

  // Step 1 — age-calibrated baseline
  const baseline = ageBaseline(input.age);
  let d = { ...baseline };
  predictionBasis.push('age_calibrated');

  // Step 2 — HRV adjustment
  const hrv = input.estimatedHRVrmssd;
  if (hrv > 55)        { d.deep += 4; d.light -= 4; }
  else if (hrv > 40)   { d.deep += 2; d.light -= 2; }
  else if (hrv < 25)   { d.deep -= 4; d.awake += 2; d.light -= 2; }
  predictionBasis.push('hrv_adjusted');

  // Step 3 — resting HR adjustment
  const hr = input.estimatedRestingHR;
  if (hr < 45)         { d.deep += 4; d.rem += 1; }
  else if (hr < 50)    { d.deep += 3; }
  else if (hr > 78)    { d.deep -= 5; d.awake += 3; }
  else if (hr > 68)    { d.deep -= 3; d.awake += 2; }
  predictionBasis.push('resting_hr_adjusted');

  // Step 4 — VO2max adjustment
  const vo2 = input.estimatedVO2Max;
  if (vo2 > 52)        { d.rem += 2; predictionBasis.push('vo2max_estimated_hrv'); }
  else if (vo2 < 35)   { d.rem -= 2; d.light += 2; }

  // Step 5 — respiratory rate
  const rr = input.estimatedRespiratoryRate;
  if (rr >= 12 && rr <= 14) { d.deep += 2; }
  else if (rr > 17)          { d.rem  += 2; d.deep -= 2; }

  // Step 6 — sleep debt rebound
  const debt = input.recentSleepDebt ?? 0;
  if (debt > 240)      { d.deep += 8; d.rem += 3; predictionBasis.push('sleep_debt_rebound'); }
  else if (debt > 120) { d.deep += 5; d.rem += 2; predictionBasis.push('sleep_debt_rebound'); }
  else if (debt >= 60) { d.deep += 3; predictionBasis.push('sleep_debt_rebound'); }

  // Step 7 — chronotype
  d = applyChronotype(d, input, predictionBasis);

  // Step 8 — personal baseline calibration
  if (input.recentAvgDeepPercent != null && input.recentAvgRemPercent != null) {
    d.deep = d.deep * 0.8 + input.recentAvgDeepPercent * 0.2;
    d.rem  = d.rem  * 0.8 + input.recentAvgRemPercent  * 0.2;
    predictionBasis.push('personal_baseline_calibrated');
    confidence = 'medium';
  }

  // Step 9 — confidence upgrade handled above

  // Step 10 — clamp & normalize
  const normed = normalize(d);

  return {
    deepPercent:  normed.deep,
    remPercent:   normed.rem,
    lightPercent: normed.light,
    awakePercent: normed.awake,
    confidence,
    predictionBasis,
  };
}

function applyChronotype(
  d: { deep: number; rem: number; light: number; awake: number },
  input: SleepPredictionInput,
  predictionBasis: string[]
): typeof d {
  const chronotype = input.chronotype ?? 'intermediate';
  if (chronotype === 'evening' && input.startTime) {
    const hour = new Date(input.startTime).getHours();
    if (hour < 23) { d.rem -= 3; predictionBasis.push('chronotype_evening_early_sleep'); }
  }
  if (chronotype === 'morning' && input.endTime) {
    const hour = new Date(input.endTime).getHours();
    if (hour >= 8) { d.deep -= 2; predictionBasis.push('chronotype_morning_late_wake'); }
  }
  return d;
}

// ------------------------------------------------------------------
// Phase timeline generation
// ------------------------------------------------------------------

export function generatePhaseTimeline(
  input: SleepPredictionInput,
  dist: PredictedStageDistribution
): SleepCycleMap {
  if (!input.startTime || !input.endTime) {
    return { estimatedCycles: 0, phaseTimeline: [], cycleBreakdown: [] };
  }

  const totalMinutes = input.durationMinutes;
  const startMs = new Date(input.startTime).getTime();
  const endMs   = new Date(input.endTime).getTime();
  const estimatedCycles = clamp(Math.round(totalMinutes / 95), 3, 6);

  let deepBudget  = totalMinutes * dist.deepPercent  / 100;
  let remBudget   = totalMinutes * dist.remPercent   / 100;
  let lightBudget = totalMinutes * dist.lightPercent / 100;
  let awakeBudget = totalMinutes * dist.awakePercent / 100;

  const events: SleepPhaseEvent[] = [];
  let currentMs = startMs;

  function pushEvent(
    stage: SleepPhaseEvent['stage'],
    durationMinutes: number,
    cycleNumber: number
  ): void {
    const dur = Math.max(0, Math.round(durationMinutes));
    if (dur <= 0) return;
    const eStart = new Date(currentMs).toISOString();
    currentMs += dur * 60_000;
    const eEnd = new Date(currentMs).toISOString();
    events.push({ stage, startTime: eStart, endTime: eEnd, durationMinutes: dur, cycleNumber });
  }

  // Pre-sleep awake (SOL)
  const hr = input.estimatedRestingHR;
  let sol = hr > 70 ? 20 : hr > 58 ? 14 : 8;
  sol = clamp(sol, 5, Math.min(25, awakeBudget));
  pushEvent('awake', sol, 0);
  awakeBudget -= sol;

  const frontCycles = Math.ceil(estimatedCycles / 3);
  const backCycles  = Math.floor(estimatedCycles / 3);

  for (let cycle = 1; cycle <= estimatedCycles; cycle++) {
    const cycleTargetMin = (totalMinutes - sol) / estimatedCycles;

    // Deep allocation — front-loaded
    let cycleDeep: number;
    if (cycle <= frontCycles) {
      cycleDeep = (deepBudget / (frontCycles + (estimatedCycles - frontCycles) * (0.4 / 0.6))) * (0.6 / frontCycles) * estimatedCycles;
      // simpler: distribute 60% over first third, 40% over rest
      cycleDeep = (deepBudget * 0.60) / frontCycles;
    } else {
      cycleDeep = (deepBudget * 0.40) / (estimatedCycles - frontCycles);
    }
    cycleDeep = Math.min(cycleDeep, deepBudget);

    // REM allocation — back-loaded
    let cycleRem: number;
    const backStart = estimatedCycles - backCycles + 1;
    if (cycle >= backStart && backCycles > 0) {
      cycleRem = (remBudget * 0.60) / backCycles;
    } else {
      const frontRemCycles = estimatedCycles - backCycles;
      cycleRem = frontRemCycles > 0 ? (remBudget * 0.40) / frontRemCycles : 0;
    }
    cycleRem = Math.min(cycleRem, remBudget);

    // Light — split for descent + ascent
    const lightPerSide = Math.min(
      Math.max(cycleTargetMin * 0.175, 5),
      lightBudget / 2
    );

    // 1. Light descent
    pushEvent('light', lightPerSide, cycle);
    lightBudget -= lightPerSide;

    // 2. Deep
    if (cycleDeep > 0) {
      pushEvent('deep', cycleDeep, cycle);
      deepBudget -= cycleDeep;
    }

    // 3. Light ascent
    pushEvent('light', lightPerSide, cycle);
    lightBudget -= lightPerSide;

    // 4. REM
    if (cycleRem > 0) {
      pushEvent('rem', cycleRem, cycle);
      remBudget -= cycleRem;
    }

    // 5. Micro-arousal at cycle boundary
    if (awakeBudget >= 2 && cycle < estimatedCycles) {
      const microAwake = Math.min(2, awakeBudget);
      pushEvent('awake', microAwake, cycle);
      awakeBudget -= microAwake;
    }
  }

  // Fill remaining time
  const remaining = Math.round((endMs - currentMs) / 60_000);
  if (remaining > 0) {
    const fillStage: SleepPhaseEvent['stage'] = awakeBudget > 0 ? 'awake' : 'light';
    pushEvent(fillStage, remaining, estimatedCycles);
  }

  // Normalise: force last event's endTime to exactly input.endTime
  if (events.length > 0) {
    const last = events[events.length - 1];
    last.endTime = input.endTime;
    // Adjust duration to match
    const actualDur = Math.round(
      (new Date(last.endTime).getTime() - new Date(last.startTime).getTime()) / 60_000
    );
    if (actualDur > 0) last.durationMinutes = actualDur;
  }

  // Verify invariant
  const totalEmitted = events.reduce((s, e) => s + e.durationMinutes, 0);
  if (Math.abs(totalEmitted - totalMinutes) > 1) {
    console.warn(
      `[sleepStagePredictor] Timeline invariant violated: emitted=${totalEmitted}, expected=${totalMinutes}`
    );
  }

  const cycleBreakdown = buildCycleBreakdown(events, estimatedCycles);

  return { estimatedCycles, phaseTimeline: events, cycleBreakdown };
}

function buildCycleBreakdown(events: SleepPhaseEvent[], estimatedCycles: number): CycleBreakdown[] {
  const breakdown: CycleBreakdown[] = [];
  for (let c = 1; c <= estimatedCycles; c++) {
    const cycleEvents = events.filter((e) => e.cycleNumber === c);
    if (cycleEvents.length === 0) continue;
    const deep  = cycleEvents.filter((e) => e.stage === 'deep').reduce((s, e) => s + e.durationMinutes, 0);
    const rem   = cycleEvents.filter((e) => e.stage === 'rem').reduce((s, e) => s + e.durationMinutes, 0);
    const light = cycleEvents.filter((e) => e.stage === 'light').reduce((s, e) => s + e.durationMinutes, 0);
    const awake = cycleEvents.filter((e) => e.stage === 'awake').reduce((s, e) => s + e.durationMinutes, 0);
    const dominant: CycleBreakdown['dominantStage'] =
      deep >= rem && deep >= light ? 'deep' : rem >= light ? 'rem' : 'light';
    breakdown.push({
      cycleNumber: c,
      startTime:        cycleEvents[0].startTime,
      endTime:          cycleEvents[cycleEvents.length - 1].endTime,
      durationMinutes:  cycleEvents.reduce((s, e) => s + e.durationMinutes, 0),
      dominantStage:    dominant,
      deepMinutes:  deep,
      remMinutes:   rem,
      lightMinutes: light,
      awakeMinutes: awake,
    });
  }
  return breakdown;
}

// ------------------------------------------------------------------
// Recovery index
// ------------------------------------------------------------------

function calculateRecoveryIndex(
  dist: PredictedStageDistribution,
  input: SleepPredictionInput
): number {
  const deepScore     = Math.min(100, (dist.deepPercent / 20) * 100) * 0.40;
  const remScore      = Math.min(100, (dist.remPercent  / 22) * 100) * 0.30;
  const durationScore = Math.min(100, (input.durationMinutes / 480) * 100) * 0.20;
  const debtImpact    = input.recentSleepDebt != null
    ? Math.max(0, 100 - (input.recentSleepDebt / 4)) * 0.10
    : 85 * 0.10;
  return Math.round(deepScore + remScore + durationScore + debtImpact);
}

// ------------------------------------------------------------------
// Insight flags
// ------------------------------------------------------------------

function generateInsightFlags(
  dist: PredictedStageDistribution,
  input: SleepPredictionInput,
  recoveryIndex: number
): string[] {
  const flags: string[] = [];
  if (dist.deepPercent >= 20 && dist.confidence !== 'low')             flags.push('OPTIMAL_DEEP');
  if (dist.deepPercent < 12)                                            flags.push('LOW_DEEP');
  if (dist.remPercent  > 27)                                            flags.push('REM_REBOUND');
  if (dist.remPercent  < 15)                                            flags.push('LOW_REM');
  if (dist.awakePercent > 15)                                           flags.push('HIGH_FRAGMENTATION');
  if ((input.recentSleepDebt ?? 0) > 180)                              flags.push('SLEEP_DEBT_HIGH');
  if ((input.recentSleepDebt ?? 0) > 120 && recoveryIndex >= 80)       flags.push('SLEEP_DEBT_CLEARING');
  if (input.estimatedVO2Max > 52 && dist.confidence !== 'low')         flags.push('AEROBIC_ADVANTAGE');
  return flags;
}

// ------------------------------------------------------------------
// Main export
// ------------------------------------------------------------------

export function buildPremiumPrediction(input: SleepPredictionInput): PremiumSleepPrediction {
  const dist     = predictStageDistribution(input);
  const cycleMap = generatePhaseTimeline(input, dist);
  const recovery = calculateRecoveryIndex(dist, input);
  const flags    = generateInsightFlags(dist, input, recovery);
  const debtMin  = input.recentSleepDebt ?? 0;

  const predictedScore = calculateSleepScore({
    current: {
      durationMinutes:   input.durationMinutes,
      deepSleepMinutes:  Math.round(input.durationMinutes * dist.deepPercent  / 100),
      remSleepMinutes:   Math.round(input.durationMinutes * dist.remPercent   / 100),
      lightSleepMinutes: Math.round(input.durationMinutes * dist.lightPercent / 100),
      awakeSleepMinutes: Math.round(input.durationMinutes * dist.awakePercent / 100),
      startTime:   input.startTime,
      endTime:     input.endTime,
      source:      'premium_prediction',
      confidence:  dist.confidence,
    } as any,
    history:     [],
    userProfile: { sleepGoalMinutes: 480, age: input.age },
  }).sleepScore;

  return {
    stageDistribution: dist,
    cycleMap,
    estimatedPhysiology: {
      estimatedVO2Max:    input.estimatedVO2Max,
      estimatedRestingHR: input.estimatedRestingHR,
      estimatedHRVrmssd:  input.estimatedHRVrmssd,
      estimatedHRMax:     Math.round(207 - 0.7 * (input.age ?? 35)),
      basisNotes:         dist.predictionBasis,
    },
    predictedSleepScore: predictedScore,
    sleepDebtMinutes:    debtMin,
    recoveryIndex:       recovery,
    insightFlags:        flags,
  };
}
