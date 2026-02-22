import type {
  CycleBreakdown,
  CycleDistributorInput,
  CycleDistributorOutput,
  SleepPhaseEvent,
} from '@shared';

export const CYCLE_DISTRIBUTOR_CONSTANTS = {
  ALGO_VERSION: 1,
  MEDIAN_CYCLE_MINUTES: 96,
  CYCLE1_MIN: 70,
  CYCLE1_MAX: 100,
  LATER_CYCLE_MIN: 85,
  LATER_CYCLE_MAX: 120,
  MIN_CYCLES: 3,
  MAX_CYCLES: 6,
  N3_DECAY_LAMBDA: 0.7,
  REM_GROWTH_FACTOR: 1.0,
  SOL_MIN_MINUTES: 5,
  SOL_MAX_MINUTES: 30,
  CYCLE1_REM_MAX: 8,
  MICRO_AROUSAL_MINS: 2,
  MAX_DRIFT_CORRECTION: 5,
  HISTORY_HIGH_CONF: 7,
  HISTORY_MED_CONF: 3,
} as const;

const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val));

function getAgeCalibratedStageTargets(age: number | null | undefined): {
  deepRatio: number;
  remRatio: number;
} {
  if (age == null) {
    return { deepRatio: 0.18, remRatio: 0.22 };
  }

  if (age < 25) {
    return { deepRatio: 0.22, remRatio: 0.23 };
  }

  if (age <= 44) {
    return { deepRatio: 0.18, remRatio: 0.22 };
  }

  if (age <= 64) {
    return { deepRatio: 0.14, remRatio: 0.2 };
  }

  return { deepRatio: 0.1, remRatio: 0.18 };
}

export function resolveStagesBudgets(input: CycleDistributorInput): {
  deepBudget: number;
  remBudget: number;
  lightBudget: number;
  awakeBudget: number;
} {
  const duration = Math.max(0, Math.round(input.durationMinutes));
  const { deepRatio, remRatio } = getAgeCalibratedStageTargets(input.age);

  let deepBudget =
    input.deepSleepMinutes != null ? Math.round(input.deepSleepMinutes) : Math.round(duration * deepRatio);
  let remBudget =
    input.remSleepMinutes != null ? Math.round(input.remSleepMinutes) : Math.round(duration * remRatio);
  const awakeBudget =
    input.awakeSleepMinutes != null
      ? Math.round(input.awakeSleepMinutes)
      : Math.round(duration * 0.07);

  deepBudget = Math.max(0, deepBudget);
  remBudget = Math.max(0, remBudget);

  let lightBudget = duration - deepBudget - remBudget - awakeBudget;
  const minLightBudget = 5;

  if (lightBudget < minLightBudget) {
    const requiredTrim = minLightBudget - lightBudget;
    const trimCapacity = deepBudget + remBudget;

    if (trimCapacity > 0) {
      let deepTrim = Math.round((requiredTrim * deepBudget) / trimCapacity);
      let remTrim = requiredTrim - deepTrim;

      deepTrim = Math.min(deepTrim, deepBudget);
      remTrim = Math.min(remTrim, remBudget);

      deepBudget -= deepTrim;
      remBudget -= remTrim;

      lightBudget = duration - deepBudget - remBudget - awakeBudget;

      if (lightBudget < minLightBudget) {
        let remainingTrim = minLightBudget - lightBudget;

        const extraDeepTrim = Math.min(remainingTrim, deepBudget);
        deepBudget -= extraDeepTrim;
        remainingTrim -= extraDeepTrim;

        const extraRemTrim = Math.min(remainingTrim, remBudget);
        remBudget -= extraRemTrim;

        lightBudget = duration - deepBudget - remBudget - awakeBudget;
      }
    }
  }

  return {
    deepBudget: Math.max(0, deepBudget),
    remBudget: Math.max(0, remBudget),
    lightBudget,
    awakeBudget: Math.max(0, awakeBudget),
  };
}

export function computeSOL(estimatedRestingHR: number, age: number): number {
  const baseSOL =
    estimatedRestingHR > 70
      ? 18
      : estimatedRestingHR > 58
        ? 13
        : estimatedRestingHR > 48
          ? 9
          : 7;

  const ageSOLAdj = Math.max(0, (age - 40) * 0.15);

  return clamp(
    Math.round(baseSOL + ageSOLAdj),
    CYCLE_DISTRIBUTOR_CONSTANTS.SOL_MIN_MINUTES,
    CYCLE_DISTRIBUTOR_CONSTANTS.SOL_MAX_MINUTES
  );
}

export function computeCycleLengths(remainingAfterSOL: number): number[] {
  const remaining = Math.max(0, Math.round(remainingAfterSOL));

  const estimatedCycles = clamp(
    Math.round(remaining / CYCLE_DISTRIBUTOR_CONSTANTS.MEDIAN_CYCLE_MINUTES),
    CYCLE_DISTRIBUTOR_CONSTANTS.MIN_CYCLES,
    CYCLE_DISTRIBUTOR_CONSTANTS.MAX_CYCLES
  );

  const cycle1Duration = clamp(
    Math.round(remaining / (estimatedCycles + 0.3)),
    CYCLE_DISTRIBUTOR_CONSTANTS.CYCLE1_MIN,
    CYCLE_DISTRIBUTOR_CONSTANTS.CYCLE1_MAX
  );

  const remainingForCycles2toN = Math.max(0, remaining - cycle1Duration);
  const laterCycleDuration =
    estimatedCycles > 1
      ? clamp(
          Math.round(remainingForCycles2toN / (estimatedCycles - 1)),
          CYCLE_DISTRIBUTOR_CONSTANTS.LATER_CYCLE_MIN,
          CYCLE_DISTRIBUTOR_CONSTANTS.LATER_CYCLE_MAX
        )
      : 0;

  const cycleLengths = [
    cycle1Duration,
    ...Array.from({ length: Math.max(0, estimatedCycles - 1) }, () => laterCycleDuration),
  ];

  const sumBeforeRemainder = cycleLengths.reduce((acc, val) => acc + val, 0);
  const remainder = remaining - sumBeforeRemainder;

  if (cycleLengths.length > 0) {
    cycleLengths[cycleLengths.length - 1] += remainder;
  }

  return cycleLengths;
}

export function distributeN3(
  cycleLengths: number[],
  deepBudget: number,
  recentSleepDebt?: number
): number[] {
  if (cycleLengths.length === 0) {
    return [];
  }

  const safeDeepBudget = Math.max(0, Math.round(deepBudget));
  const rawWeights = cycleLengths.map((_, i) =>
    Math.exp(-CYCLE_DISTRIBUTOR_CONSTANTS.N3_DECAY_LAMBDA * i)
  );
  const totalWeight = rawWeights.reduce((acc, val) => acc + val, 0);

  const deepPerCycle = rawWeights.map((weight) =>
    Math.max(0, Math.round((safeDeepBudget * weight) / totalWeight))
  );

  if ((recentSleepDebt ?? 0) > 60 && deepPerCycle.length > 1) {
    const debtBoost = Math.min(0.25, (recentSleepDebt ?? 0) / 960);
    const transfer = Math.round(deepPerCycle[0] * debtBoost);

    if (transfer > 0) {
      deepPerCycle[0] += transfer;
      distributeTransferAcrossDonorCycles(deepPerCycle, transfer);
    }
  }

  clampAllNonNegative(deepPerCycle);
  forceSumToTarget(deepPerCycle, safeDeepBudget, true);

  return deepPerCycle;
}

export function distributeREM(
  cycleLengths: number[],
  remBudget: number,
  startTime: string
): number[] {
  if (cycleLengths.length === 0) {
    return [];
  }

  const safeRemBudget = Math.max(0, Math.round(remBudget));

  const remRawWeights = cycleLengths.map((_, i) =>
    Math.log(1 + CYCLE_DISTRIBUTOR_CONSTANTS.REM_GROWTH_FACTOR * (i + 1))
  );
  const remTotalWeight = remRawWeights.reduce((acc, val) => acc + val, 0);

  const remPerCycle = remRawWeights.map((weight) =>
    Math.max(0, Math.round((safeRemBudget * weight) / remTotalWeight))
  );

  const originalCycle1Rem = remPerCycle[0];
  remPerCycle[0] = clamp(remPerCycle[0], 1, CYCLE_DISTRIBUTOR_CONSTANTS.CYCLE1_REM_MAX);
  const clampDifference = remPerCycle[0] - originalCycle1Rem;
  redistributeDifferenceToLaterCycles(remPerCycle, clampDifference);

  const bedtimeHour = new Date(startTime).getHours();
  if (!Number.isNaN(bedtimeHour)) {
    const cycle1BeforeCircadian = remPerCycle[0];

    if (bedtimeHour >= 22 && bedtimeHour <= 23) {
      remPerCycle[0] = Math.max(1, Math.round(remPerCycle[0] * 0.5));
    } else if (bedtimeHour >= 0 && bedtimeHour <= 3) {
      remPerCycle[0] = Math.min(remPerCycle[0], 10);
    }

    const circadianDifference = remPerCycle[0] - cycle1BeforeCircadian;
    redistributeDifferenceToLaterCycles(remPerCycle, circadianDifference);
  }

  clampAllNonNegative(remPerCycle);
  forceSumToTarget(remPerCycle, safeRemBudget, false);

  return remPerCycle;
}

export function allocateLightAndAwake(
  cycleLengths: number[],
  deepPerCycle: number[],
  remPerCycle: number[],
  awakeBudget: number
): {
  lightPerCycle: number[];
  microArousals: number[];
} {
  const lightPerCycle: number[] = [];
  const microArousals: number[] = [];
  let remainingAwake = Math.max(0, Math.round(awakeBudget));

  for (let c = 0; c < cycleLengths.length; c += 1) {
    const microArousal =
      remainingAwake > 3
        ? CYCLE_DISTRIBUTOR_CONSTANTS.MICRO_AROUSAL_MINS
        : remainingAwake > 0
          ? 1
          : 0;
    remainingAwake -= microArousal;

    let lightForCycle =
      cycleLengths[c] - (deepPerCycle[c] ?? 0) - (remPerCycle[c] ?? 0) - microArousal;

    if (lightForCycle < 5) {
      const deficit = 5 - lightForCycle;
      const deepTrim = Math.min(Math.max(0, deepPerCycle[c] ?? 0), deficit);
      deepPerCycle[c] = Math.max(0, (deepPerCycle[c] ?? 0) - deepTrim);
      lightForCycle += deepTrim;
    }

    lightPerCycle.push(Math.max(5, lightForCycle));
    microArousals.push(Math.max(0, microArousal));
  }

  if (remainingAwake > 0 && microArousals.length > 0) {
    const lastIndex = microArousals.length - 1;
    microArousals[lastIndex] += remainingAwake;
    lightPerCycle[lastIndex] -= remainingAwake;

    if (lightPerCycle[lastIndex] < 5) {
      const deficit = 5 - lightPerCycle[lastIndex];
      const deepTrim = Math.min(Math.max(0, deepPerCycle[lastIndex] ?? 0), deficit);
      deepPerCycle[lastIndex] = Math.max(0, (deepPerCycle[lastIndex] ?? 0) - deepTrim);
      lightPerCycle[lastIndex] += deepTrim;
    }

    if (lightPerCycle[lastIndex] < 5) {
      lightPerCycle[lastIndex] = 5;
    }
  }

  return { lightPerCycle, microArousals };
}

export function buildTimeline(params: {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  finalSOL: number;
  deepPerCycle: number[];
  remPerCycle: number[];
  lightPerCycle: number[];
  microArousals: number[];
  estimatedCycles: number;
}): SleepPhaseEvent[] {
  const {
    startTime,
    endTime,
    durationMinutes,
    finalSOL,
    deepPerCycle,
    remPerCycle,
    lightPerCycle,
    microArousals,
    estimatedCycles,
  } = params;

  let cursor = new Date(startTime).getTime();
  const events: SleepPhaseEvent[] = [];

  events.push({
    stage: 'awake',
    startTime: new Date(cursor).toISOString(),
    endTime: new Date(cursor + finalSOL * 60_000).toISOString(),
    durationMinutes: finalSOL,
    cycleNumber: 0,
  });
  cursor += finalSOL * 60_000;

  for (let c = 0; c < estimatedCycles; c += 1) {
    const lightDescent = Math.round((lightPerCycle[c] ?? 0) * 0.45);
    const lightAscent = (lightPerCycle[c] ?? 0) - lightDescent;

    const phases: ['awake' | 'light' | 'deep' | 'rem', number][] = [
      ['light', lightDescent],
      ['deep', deepPerCycle[c] ?? 0],
      ['light', lightAscent],
      ['rem', remPerCycle[c] ?? 0],
      ['awake', microArousals[c] ?? 0],
    ];

    for (const [stage, mins] of phases) {
      if (mins <= 0) {
        continue;
      }

      events.push({
        stage,
        startTime: new Date(cursor).toISOString(),
        endTime: new Date(cursor + mins * 60_000).toISOString(),
        durationMinutes: mins,
        cycleNumber: c + 1,
      });
      cursor += mins * 60_000;
    }
  }

  const targetEndMs = new Date(endTime).getTime();
  const drift = targetEndMs - cursor;
  if (Math.abs(drift) <= CYCLE_DISTRIBUTOR_CONSTANTS.MAX_DRIFT_CORRECTION * 60_000) {
    const lastEvent = events[events.length - 1];
    if (lastEvent) {
      const adjustedMinutes = Math.round(drift / 60_000);
      const newDuration = Math.max(1, lastEvent.durationMinutes + adjustedMinutes);
      events[events.length - 1] = {
        ...lastEvent,
        durationMinutes: newDuration,
        endTime: new Date(targetEndMs).toISOString(),
      };
      cursor = targetEndMs;
    }
  } else {
    console.warn(
      '[SleepCycleDistributor] Drift exceeds correction limit:',
      drift / 60_000,
      'min'
    );
  }

  const totalMins = events.reduce((sum, event) => sum + event.durationMinutes, 0);
  if (Math.abs(totalMins - durationMinutes) > 1) {
    throw new Error(
      `Timeline invariant violated: total duration ${totalMins} != ${durationMinutes} (+/-1)`
    );
  }

  for (let i = 0; i < events.length; i += 1) {
    if (events[i].durationMinutes <= 0) {
      throw new Error(`Timeline invariant violated: non-positive duration at index ${i}`);
    }
  }

  for (let i = 0; i < events.length - 1; i += 1) {
    if (events[i].endTime !== events[i + 1].startTime) {
      throw new Error(
        `Timeline invariant violated: gap at index ${i} (${events[i].endTime} -> ${events[i + 1].startTime})`
      );
    }
  }

  return events;
}

export function computeConfidence(input: CycleDistributorInput): 'high' | 'medium' | 'low' {
  const hasRealStageData = input.deepSleepMinutes != null && input.remSleepMinutes != null;
  const historyNights = input.historyNightCount ?? 0;

  if (hasRealStageData && historyNights >= CYCLE_DISTRIBUTOR_CONSTANTS.HISTORY_HIGH_CONF) {
    return 'high';
  }
  if (hasRealStageData && historyNights >= CYCLE_DISTRIBUTOR_CONSTANTS.HISTORY_MED_CONF) {
    return 'medium';
  }
  if (hasRealStageData || historyNights >= CYCLE_DISTRIBUTOR_CONSTANTS.HISTORY_MED_CONF) {
    return 'medium';
  }
  return 'low';
}

export function buildCycleBreakdown(
  phaseTimeline: SleepPhaseEvent[],
  estimatedCycles: number
): CycleBreakdown[] {
  const breakdown: CycleBreakdown[] = [];

  for (let cycleNumber = 1; cycleNumber <= estimatedCycles; cycleNumber += 1) {
    const cycleEvents = phaseTimeline.filter((event) => event.cycleNumber === cycleNumber);
    if (cycleEvents.length === 0) {
      continue;
    }

    const deepMinutes = cycleEvents
      .filter((event) => event.stage === 'deep')
      .reduce((sum, event) => sum + event.durationMinutes, 0);
    const remMinutes = cycleEvents
      .filter((event) => event.stage === 'rem')
      .reduce((sum, event) => sum + event.durationMinutes, 0);
    const lightMinutes = cycleEvents
      .filter((event) => event.stage === 'light')
      .reduce((sum, event) => sum + event.durationMinutes, 0);
    const awakeMinutes = cycleEvents
      .filter((event) => event.stage === 'awake')
      .reduce((sum, event) => sum + event.durationMinutes, 0);

    const dominantStage =
      deepMinutes >= remMinutes && deepMinutes >= lightMinutes
        ? 'deep'
        : remMinutes >= lightMinutes
          ? 'rem'
          : 'light';

    breakdown.push({
      cycleNumber,
      startTime: cycleEvents[0].startTime,
      endTime: cycleEvents[cycleEvents.length - 1].endTime,
      durationMinutes: cycleEvents.reduce((sum, event) => sum + event.durationMinutes, 0),
      dominantStage,
      deepMinutes,
      remMinutes,
      lightMinutes,
      awakeMinutes,
    });
  }

  return breakdown;
}

export function distributeSleepcycles(
  input: CycleDistributorInput
): CycleDistributorOutput | null {
  if (!input.startTime?.trim() || !input.endTime?.trim()) {
    return null;
  }

  try {
    const duration = Math.max(0, Math.round(input.durationMinutes));
    const stageBudgets = resolveStagesBudgets(input);
    const finalSOL = computeSOL(input.estimatedRestingHR, input.age);
    const remainingAfterSOL = Math.max(0, duration - finalSOL);
    const cycleLengths = computeCycleLengths(remainingAfterSOL);
    const estimatedCycles = cycleLengths.length;

    let deepPerCycle = distributeN3(cycleLengths, stageBudgets.deepBudget, input.recentSleepDebt);
    let remPerCycle = distributeREM(cycleLengths, stageBudgets.remBudget, input.startTime);

    if (input.personalDeepRatio != null && input.personalRemRatio != null) {
      const { deepRatio, remRatio } = getAgeCalibratedStageTargets(input.age);
      const adjustedDeepBudget = Math.max(
        0,
        Math.round(duration * (deepRatio * 0.6 + input.personalDeepRatio * 0.4))
      );
      const adjustedRemBudget = Math.max(
        0,
        Math.round(duration * (remRatio * 0.6 + input.personalRemRatio * 0.4))
      );

      deepPerCycle = distributeN3(cycleLengths, adjustedDeepBudget, input.recentSleepDebt);
      remPerCycle = distributeREM(cycleLengths, adjustedRemBudget, input.startTime);
    }

    // Age effect: N3 declines progressively after 25, so reduce first-cycle deep
    // and redistribute to later cycles while preserving total deep minutes.
    if (deepPerCycle.length > 1 && Number.isFinite(input.age)) {
      const decadesAfter25 = Math.max(0, (input.age - 25) / 10);
      const ageAttenuation = clamp(1 - decadesAfter25 * 0.02, 0.75, 1);
      const originalCycle1Deep = deepPerCycle[0];
      const adjustedCycle1Deep = Math.max(0, Math.round(originalCycle1Deep * ageAttenuation));
      const removed = originalCycle1Deep - adjustedCycle1Deep;

      if (removed > 0) {
        deepPerCycle[0] = adjustedCycle1Deep;
        for (let i = 1; i < deepPerCycle.length; i += 1) {
          deepPerCycle[i] += Math.floor(removed / (deepPerCycle.length - 1));
        }
        deepPerCycle[deepPerCycle.length - 1] += removed % (deepPerCycle.length - 1);
        forceSumToTarget(deepPerCycle, stageBudgets.deepBudget, true);
      }
    }

    const awakeBudgetAfterSOL = Math.max(0, stageBudgets.awakeBudget - finalSOL);
    const { lightPerCycle, microArousals } = allocateLightAndAwake(
      cycleLengths,
      deepPerCycle,
      remPerCycle,
      awakeBudgetAfterSOL
    );

    const phaseTimeline = buildTimeline({
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: duration,
      finalSOL,
      deepPerCycle,
      remPerCycle,
      lightPerCycle,
      microArousals,
      estimatedCycles,
    });

    const confidence = computeConfidence(input);
    const cycleBreakdown = buildCycleBreakdown(phaseTimeline, estimatedCycles);

    return {
      phaseTimeline,
      estimatedCycles,
      cycleBreakdown,
      confidence,
      algorithmVersion: CYCLE_DISTRIBUTOR_CONSTANTS.ALGO_VERSION,
    };
  } catch (error) {
    console.warn('[SleepCycleDistributor] Failed to distribute sleep cycles:', error);
    return null;
  }
}

function distributeTransferAcrossDonorCycles(values: number[], transfer: number): void {
  const donorIndices = values
    .map((value, index) => ({ value, index }))
    .filter(({ index, value }) => index > 0 && value > 0)
    .map(({ index }) => index);

  if (donorIndices.length === 0 || transfer <= 0) {
    return;
  }

  const donorTotal = donorIndices.reduce((acc, idx) => acc + values[idx], 0);
  let remainingTransfer = transfer;

  for (const idx of donorIndices) {
    if (remainingTransfer <= 0 || donorTotal <= 0) {
      break;
    }

    const proportionalTrim = Math.round((values[idx] / donorTotal) * transfer);
    const trim = Math.min(values[idx], proportionalTrim, remainingTransfer);

    values[idx] -= trim;
    remainingTransfer -= trim;
  }

  while (remainingTransfer > 0) {
    let trimmedAny = false;

    for (const idx of donorIndices) {
      if (remainingTransfer <= 0) {
        break;
      }

      if (values[idx] > 0) {
        values[idx] -= 1;
        remainingTransfer -= 1;
        trimmedAny = true;
      }
    }

    if (!trimmedAny) {
      break;
    }
  }
}

function redistributeDifferenceToLaterCycles(values: number[], cycle0Difference: number): void {
  if (values.length <= 1 || cycle0Difference === 0) {
    return;
  }

  const laterIndices = values
    .map((_, index) => index)
    .filter((index) => index > 0);

  const requiredLaterDelta = -cycle0Difference;

  if (requiredLaterDelta > 0) {
    const laterTotal = laterIndices.reduce((acc, idx) => acc + values[idx], 0);

    if (laterTotal > 0) {
      let remaining = requiredLaterDelta;

      for (const idx of laterIndices) {
        if (remaining <= 0) {
          break;
        }

        const add = Math.round((values[idx] / laterTotal) * requiredLaterDelta);
        values[idx] += add;
        remaining -= add;
      }

      let pointer = 0;
      while (remaining > 0) {
        const idx = laterIndices[pointer % laterIndices.length];
        values[idx] += 1;
        remaining -= 1;
        pointer += 1;
      }
    } else {
      let remaining = requiredLaterDelta;
      let pointer = 0;

      while (remaining > 0) {
        const idx = laterIndices[pointer % laterIndices.length];
        values[idx] += 1;
        remaining -= 1;
        pointer += 1;
      }
    }

    return;
  }

  let remainingToTrim = Math.abs(requiredLaterDelta);
  const positiveLaterIndices = laterIndices.filter((idx) => values[idx] > 0);
  const positiveLaterTotal = positiveLaterIndices.reduce((acc, idx) => acc + values[idx], 0);

  if (positiveLaterTotal > 0) {
    for (const idx of positiveLaterIndices) {
      if (remainingToTrim <= 0) {
        break;
      }

      const proportionalTrim = Math.round((values[idx] / positiveLaterTotal) * remainingToTrim);
      const trim = Math.min(values[idx], proportionalTrim, remainingToTrim);
      values[idx] -= trim;
      remainingToTrim -= trim;
    }
  }

  while (remainingToTrim > 0) {
    let trimmedAny = false;

    for (const idx of laterIndices) {
      if (remainingToTrim <= 0) {
        break;
      }

      if (values[idx] > 0) {
        values[idx] -= 1;
        remainingToTrim -= 1;
        trimmedAny = true;
      }
    }

    if (!trimmedAny) {
      break;
    }
  }
}

function clampAllNonNegative(values: number[]): void {
  for (let i = 0; i < values.length; i += 1) {
    values[i] = Math.max(0, values[i]);
  }
}

function forceSumToTarget(values: number[], target: number, preferLastNonZero: boolean): void {
  const safeTarget = Math.max(0, Math.round(target));

  let currentSum = values.reduce((acc, val) => acc + val, 0);
  let delta = safeTarget - currentSum;

  if (delta === 0) {
    return;
  }

  let preferredIndex = values.length - 1;
  if (preferLastNonZero) {
    for (let i = values.length - 1; i >= 0; i -= 1) {
      if (values[i] > 0) {
        preferredIndex = i;
        break;
      }
    }
  }

  if (delta > 0) {
    values[preferredIndex] += delta;
  } else {
    let remaining = Math.abs(delta);

    for (let i = values.length - 1; i >= 0; i -= 1) {
      if (remaining <= 0) {
        break;
      }

      const trim = Math.min(values[i], remaining);
      values[i] -= trim;
      remaining -= trim;
    }

    if (remaining > 0) {
      values[preferredIndex] = Math.max(0, values[preferredIndex] - remaining);
    }
  }

  currentSum = values.reduce((acc, val) => acc + val, 0);
  delta = safeTarget - currentSum;

  if (delta !== 0 && values.length > 0) {
    values[values.length - 1] = Math.max(0, values[values.length - 1] + delta);
  }
}

