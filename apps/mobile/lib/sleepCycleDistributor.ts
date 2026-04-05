import type {
  CycleDistributorInput,
  CycleDistributorOutput,
  SleepPhaseEvent,
  CycleBreakdown,
} from '@shared';

const ALGORITHM_VERSION = 1;

export const CYCLE_DISTRIBUTOR_CONSTANTS = {
  ALGO_VERSION: ALGORITHM_VERSION,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function ageBaseline(age: number): { deep: number; rem: number; light: number; awake: number } {
  if (age < 25)  return { deep: 22, rem: 23, light: 50, awake: 5 };
  if (age < 45)  return { deep: 18, rem: 22, light: 52, awake: 8 };
  if (age < 65)  return { deep: 14, rem: 20, light: 56, awake: 10 };
  return           { deep: 10, rem: 18, light: 60, awake: 12 };
}

function normalize(d: { deep: number; rem: number; light: number; awake: number }) {
  const awake = clamp(d.awake, 2, 25);
  const light = clamp(d.light, 30, 60);
  const deep  = clamp(d.deep,  5, 35);
  const rem   = clamp(d.rem,  10, 35);
  const factor = 100 / (awake + light + deep + rem);
  return { deep: deep * factor, rem: rem * factor, light: light * factor, awake: awake * factor };
}

function buildCycleBreakdown(
  events: SleepPhaseEvent[],
  estimatedCycles: number
): CycleBreakdown[] {
  const breakdown: CycleBreakdown[] = [];
  for (let c = 1; c <= estimatedCycles; c++) {
    const ce = events.filter((e) => e.cycleNumber === c);
    if (ce.length === 0) continue;
    const deep  = ce.filter((e) => e.stage === 'deep').reduce((s, e) => s + e.durationMinutes, 0);
    const rem   = ce.filter((e) => e.stage === 'rem').reduce((s, e) => s + e.durationMinutes, 0);
    const light = ce.filter((e) => e.stage === 'light').reduce((s, e) => s + e.durationMinutes, 0);
    const awake = ce.filter((e) => e.stage === 'awake').reduce((s, e) => s + e.durationMinutes, 0);
    const dominant: CycleBreakdown['dominantStage'] =
      deep >= rem && deep >= light ? 'deep' : rem >= light ? 'rem' : 'light';
    breakdown.push({
      cycleNumber:     c,
      startTime:       ce[0].startTime,
      endTime:         ce[ce.length - 1].endTime,
      durationMinutes: ce.reduce((s, e) => s + e.durationMinutes, 0),
      dominantStage:   dominant,
      deepMinutes:  deep,
      remMinutes:   rem,
      lightMinutes: light,
      awakeMinutes: awake,
    });
  }
  return breakdown;
}

export function distributeSleepcycles(input: CycleDistributorInput): CycleDistributorOutput | null {
  if (!input.startTime || !input.endTime || !input.durationMinutes) return null;

  const totalMinutes = input.durationMinutes;
  const startMs = new Date(input.startTime).getTime();
  const endMs   = new Date(input.endTime).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || totalMinutes <= 0) return null;

  const estimatedCycles = clamp(Math.round(totalMinutes / 95), 3, 6);

  // Determine stage distribution
  const sumExisting =
    (input.deepSleepMinutes  ?? 0) +
    (input.remSleepMinutes   ?? 0) +
    (input.lightSleepMinutes ?? 0) +
    (input.awakeSleepMinutes ?? 0);

  const hasRealData =
    input.deepSleepMinutes  != null &&
    input.remSleepMinutes   != null &&
    input.lightSleepMinutes != null &&
    input.awakeSleepMinutes != null &&
    Math.abs(sumExisting - totalMinutes) <= totalMinutes * 0.05;

  let dist: { deep: number; rem: number; light: number; awake: number };
  let confidence: CycleDistributorOutput['confidence'] = 'low';

  if (hasRealData) {
    dist = {
      deep:  (input.deepSleepMinutes!  / totalMinutes) * 100,
      rem:   (input.remSleepMinutes!   / totalMinutes) * 100,
      light: (input.lightSleepMinutes! / totalMinutes) * 100,
      awake: (input.awakeSleepMinutes! / totalMinutes) * 100,
    };
    confidence = 'high';
  } else {
    dist = ageBaseline(input.age);

    // HRV proxy via resting HR (fitness indicator without wearable)
    const hr = input.estimatedRestingHR;
    if (hr < 50)      { dist.deep += 3; }
    else if (hr > 70) { dist.deep -= 3; dist.awake += 2; }

    // VO2max
    const vo2 = input.estimatedVO2Max;
    if (vo2 > 52)     { dist.rem += 2; }
    else if (vo2 < 35){ dist.rem -= 2; dist.light += 2; }

    // Sleep debt
    const debt = input.recentSleepDebt ?? 0;
    if (debt > 240)      { dist.deep += 8; dist.rem += 3; }
    else if (debt > 120) { dist.deep += 5; dist.rem += 2; }
    else if (debt >= 60) { dist.deep += 3; }

    // Personal calibration
    if (input.personalDeepRatio != null && input.personalRemRatio != null) {
      dist.deep = dist.deep * 0.8 + input.personalDeepRatio * 100 * 0.2;
      dist.rem  = dist.rem  * 0.8 + input.personalRemRatio  * 100 * 0.2;
      confidence = 'medium';
    }

    dist = normalize(dist);
  }

  let deepBudget  = totalMinutes * dist.deep  / 100;
  let remBudget   = totalMinutes * dist.rem   / 100;
  let lightBudget = totalMinutes * dist.light / 100;
  let awakeBudget = totalMinutes * dist.awake / 100;

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
  const hr2 = input.estimatedRestingHR;
  let sol = hr2 > 70 ? 20 : hr2 > 58 ? 14 : 8;
  sol = clamp(sol, 5, Math.min(25, awakeBudget));
  pushEvent('awake', sol, 0);
  awakeBudget -= sol;

  const frontCycles = Math.ceil(estimatedCycles / 3);
  const backCycles  = Math.floor(estimatedCycles / 3);

  for (let cycle = 1; cycle <= estimatedCycles; cycle++) {
    const cycleTargetMin = (totalMinutes - sol) / estimatedCycles;

    let cycleDeep: number;
    if (cycle <= frontCycles) {
      cycleDeep = (deepBudget * 0.60) / frontCycles;
    } else {
      cycleDeep = (deepBudget * 0.40) / Math.max(1, estimatedCycles - frontCycles);
    }
    cycleDeep = Math.min(cycleDeep, deepBudget);

    let cycleRem: number;
    const backStart = estimatedCycles - backCycles + 1;
    if (cycle >= backStart && backCycles > 0) {
      cycleRem = (remBudget * 0.60) / backCycles;
    } else {
      const frontRemCycles = estimatedCycles - backCycles;
      cycleRem = frontRemCycles > 0 ? (remBudget * 0.40) / frontRemCycles : 0;
    }
    cycleRem = Math.min(cycleRem, remBudget);

    const lightPerSide = Math.min(
      Math.max(cycleTargetMin * 0.175, 5),
      lightBudget / 2
    );

    pushEvent('light', lightPerSide, cycle);
    lightBudget -= lightPerSide;

    if (cycleDeep > 0) {
      pushEvent('deep', cycleDeep, cycle);
      deepBudget -= cycleDeep;
    }

    pushEvent('light', lightPerSide, cycle);
    lightBudget -= lightPerSide;

    if (cycleRem > 0) {
      pushEvent('rem', cycleRem, cycle);
      remBudget -= cycleRem;
    }

    if (awakeBudget >= 2 && cycle < estimatedCycles) {
      const micro = Math.min(2, awakeBudget);
      pushEvent('awake', micro, cycle);
      awakeBudget -= micro;
    }
  }

  // Fill remaining
  const remaining = Math.round((endMs - currentMs) / 60_000);
  if (remaining > 0) {
    pushEvent(awakeBudget > 0 ? 'awake' : 'light', remaining, estimatedCycles);
  }

  // Normalise last event's endTime
  if (events.length > 0) {
    const last = events[events.length - 1];
    last.endTime = input.endTime;
    const actualDur = Math.round(
      (new Date(last.endTime).getTime() - new Date(last.startTime).getTime()) / 60_000
    );
    if (actualDur > 0) last.durationMinutes = actualDur;
  }

  const totalEmitted = events.reduce((s, e) => s + e.durationMinutes, 0);
  if (Math.abs(totalEmitted - totalMinutes) > 1) {
    console.warn(
      `[sleepCycleDistributor] Invariant violated: emitted=${totalEmitted}, expected=${totalMinutes}`
    );
  }

  const cycleBreakdown = buildCycleBreakdown(events, estimatedCycles);

  return {
    phaseTimeline:    events,
    estimatedCycles,
    cycleBreakdown,
    confidence,
    algorithmVersion: ALGORITHM_VERSION,
  };
}
