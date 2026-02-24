/// <reference types="jest" />

import type { SleepRecord } from '@shared';
import { calculateSleepScore } from '../sleepAnalysis';
import { isPaidPlan } from '../planUtils';
import { buildPremiumPrediction } from '../sleepStagePredictor';

function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

function makePredictionInput(overrides: Record<string, unknown> = {}) {
  const durationMinutes = (overrides.durationMinutes as number) ?? 480;
  const startTime = (overrides.startTime as string) ?? '2026-02-01T23:00:00.000Z';
  const endTime = (overrides.endTime as string) ?? plusMinutes(startTime, durationMinutes);

  return {
    durationMinutes,
    startTime,
    endTime,
    existingDeepMinutes: null,
    existingRemMinutes: null,
    existingLightMinutes: null,
    existingAwakeMinutes: null,
    estimatedVO2Max: 45,
    estimatedRestingHR: 56,
    estimatedHRVrmssd: 30,
    estimatedRespiratoryRate: 14,
    age: 34,
    sex: 'male' as const,
    chronotype: 'intermediate' as const,
    previousNightDurationMinutes: 460,
    recentSleepDebt: 0,
    recentAvgDeepPercent: undefined,
    recentAvgRemPercent: undefined,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<SleepRecord> = {}): SleepRecord {
  return {
    id: 'record-1',
    date: '2026-02-01',
    startTime: '2026-02-01T23:00:00.000Z',
    endTime: '2026-02-02T07:00:00.000Z',
    durationMinutes: 480,
    deepSleepMinutes: 96,
    remSleepMinutes: 96,
    lightSleepMinutes: 288,
    awakeSleepMinutes: 20,
    source: 'health_connect',
    confidence: 'high',
    estimatedBedtime: null,
    estimatedWakeup: null,
    screenTimeSummary: null,
    ...overrides,
  };
}

describe('sleepStagePredictor', () => {
  test('1) Null existing stages + low-confidence physiology -> low confidence and output sums to 100', () => {
    const prediction = buildPremiumPrediction(
      makePredictionInput({
        estimatedVO2Max: 30,
        estimatedRestingHR: 78,
        estimatedHRVrmssd: 18,
        estimatedRespiratoryRate: 17,
        existingDeepMinutes: null,
        existingRemMinutes: null,
        existingLightMinutes: null,
        existingAwakeMinutes: null,
        recentAvgDeepPercent: undefined,
        recentAvgRemPercent: undefined,
      })
    );
    const dist = prediction.stageDistribution;
    const total = dist.awakePercent + dist.lightPercent + dist.deepPercent + dist.remPercent;

    expect(dist.confidence).toBe('low');
    expect(total).toBeCloseTo(100, 5);
  });

  test('2) High HRV increases deep% vs low HRV baseline (same age)', () => {
    const high = buildPremiumPrediction(
      makePredictionInput({
        estimatedHRVrmssd: 65,
        estimatedRestingHR: 56,
        estimatedVO2Max: 45,
      })
    );
    const low = buildPremiumPrediction(
      makePredictionInput({
        estimatedHRVrmssd: 20,
        estimatedRestingHR: 56,
        estimatedVO2Max: 45,
      })
    );

    expect(high.stageDistribution.deepPercent).toBeGreaterThan(low.stageDistribution.deepPercent);
  });

  test('3) Sleep debt 250min raises deep% and rem% vs zero-debt baseline', () => {
    const debt = buildPremiumPrediction(makePredictionInput({ recentSleepDebt: 250 }));
    const baseline = buildPremiumPrediction(makePredictionInput({ recentSleepDebt: 0 }));

    expect(debt.stageDistribution.deepPercent).toBeGreaterThan(
      baseline.stageDistribution.deepPercent
    );
    expect(debt.stageDistribution.remPercent).toBeGreaterThan(
      baseline.stageDistribution.remPercent
    );
  });

  test('4) Real existing stage data -> confidence high and exact distribution match', () => {
    const prediction = buildPremiumPrediction(
      makePredictionInput({
        durationMinutes: 480,
        existingDeepMinutes: 96,
        existingRemMinutes: 120,
        existingLightMinutes: 220,
        existingAwakeMinutes: 44,
      })
    );
    const dist = prediction.stageDistribution;

    expect(dist.confidence).toBe('high');
    expect(dist.deepPercent).toBeCloseTo((96 / 480) * 100, 5);
    expect(dist.remPercent).toBeCloseTo((120 / 480) * 100, 5);
    expect(dist.lightPercent).toBeCloseTo((220 / 480) * 100, 5);
    expect(dist.awakePercent).toBeCloseTo((44 / 480) * 100, 5);
  });

  test('5) Percentages are clamped to bounds', () => {
    const dist = buildPremiumPrediction(
      makePredictionInput({
        estimatedHRVrmssd: 80,
        estimatedRestingHR: 38,
        estimatedVO2Max: 80,
        estimatedRespiratoryRate: 12,
        recentSleepDebt: 300,
      })
    ).stageDistribution;

    expect(dist.awakePercent).toBeGreaterThanOrEqual(2);
    expect(dist.awakePercent).toBeLessThanOrEqual(25);
    expect(dist.lightPercent).toBeGreaterThanOrEqual(30);
    expect(dist.lightPercent).toBeLessThanOrEqual(60);
    expect(dist.deepPercent).toBeGreaterThanOrEqual(5);
    expect(dist.deepPercent).toBeLessThanOrEqual(35);
    expect(dist.remPercent).toBeGreaterThanOrEqual(10);
    expect(dist.remPercent).toBeLessThanOrEqual(35);
  });

  test('6) generatePhaseTimeline total duration equals input duration ±1', () => {
    const durationMinutes = 463;
    const prediction = buildPremiumPrediction(makePredictionInput({ durationMinutes }));
    const total = prediction.cycleMap.phaseTimeline.reduce((sum, e) => sum + e.durationMinutes, 0);

    expect(Math.abs(total - durationMinutes)).toBeLessThanOrEqual(1);
  });

  test('7) generatePhaseTimeline has no gaps/overlaps (event end == next start)', () => {
    const events = buildPremiumPrediction(makePredictionInput()).cycleMap.phaseTimeline;
    for (let i = 0; i < events.length - 1; i += 1) {
      expect(events[i].endTime).toBe(events[i + 1].startTime);
    }
  });

  test('8) generatePhaseTimeline first event is awake with cycleNumber=0', () => {
    const first = buildPremiumPrediction(makePredictionInput()).cycleMap.phaseTimeline[0];
    expect(first.stage).toBe('awake');
    expect(first.cycleNumber).toBe(0);
  });

  test('9) estimatedCycles in [3,6] for valid input', () => {
    const short = buildPremiumPrediction(makePredictionInput({ durationMinutes: 240 })).cycleMap;
    const long = buildPremiumPrediction(makePredictionInput({ durationMinutes: 720 })).cycleMap;

    expect(short.estimatedCycles).toBeGreaterThanOrEqual(3);
    expect(short.estimatedCycles).toBeLessThanOrEqual(6);
    expect(long.estimatedCycles).toBeGreaterThanOrEqual(3);
    expect(long.estimatedCycles).toBeLessThanOrEqual(6);
  });

  test("10) isPaidPlan('free') false, isPaidPlan('pro') true, isPaidPlan(undefined) false", () => {
    expect(isPaidPlan('free')).toBe(false);
    expect(isPaidPlan('pro')).toBe(true);
    expect(isPaidPlan(undefined)).toBe(false);
  });
});

describe('score improvements', () => {
  test('11) 8h sleep with 22% deep and 22% REM -> score >= 82', () => {
    const result = calculateSleepScore({
      current: makeRecord({
        durationMinutes: 480,
        deepSleepMinutes: 106,
        remSleepMinutes: 106,
        lightSleepMinutes: 268,
        awakeSleepMinutes: 10,
        startTime: '2026-02-01T23:00:00.000Z',
        endTime: '2026-02-02T07:10:00.000Z',
      }),
      history: [],
      userProfile: { age: 30, sleepGoalMinutes: 480, chronotype: 'intermediate' },
    });

    expect(result.sleepScore).toBeGreaterThanOrEqual(82);
  });

  test('12) 4h sleep -> score < 48', () => {
    const result = calculateSleepScore({
      current: makeRecord({
        durationMinutes: 240,
        deepSleepMinutes: 40,
        remSleepMinutes: 45,
        lightSleepMinutes: 155,
        awakeSleepMinutes: 25,
        startTime: '2026-02-01T01:00:00.000Z',
        endTime: '2026-02-01T05:25:00.000Z',
      }),
      history: [],
      userProfile: { age: 30, sleepGoalMinutes: 480, chronotype: 'intermediate' },
    });

    expect(result.sleepScore).toBeLessThan(48);
  });

  test('13) Same duration, awake_minutes=60 -> lower WASO component than awake_minutes=5', () => {
    const lowAwake = calculateSleepScore({
      current: makeRecord({
        durationMinutes: 450,
        deepSleepMinutes: 90,
        remSleepMinutes: 99,
        lightSleepMinutes: 261,
        awakeSleepMinutes: 5,
        startTime: '2026-02-01T23:00:00.000Z',
        endTime: '2026-02-02T06:35:00.000Z',
      }),
      history: [],
      userProfile: { age: 30, sleepGoalMinutes: 480, chronotype: 'intermediate' },
    });
    const highAwake = calculateSleepScore({
      current: makeRecord({
        durationMinutes: 450,
        deepSleepMinutes: 90,
        remSleepMinutes: 99,
        lightSleepMinutes: 261,
        awakeSleepMinutes: 60,
        startTime: '2026-02-01T23:00:00.000Z',
        endTime: '2026-02-02T07:30:00.000Z',
      }),
      history: [],
      userProfile: { age: 30, sleepGoalMinutes: 480, chronotype: 'intermediate' },
    });

    expect(highAwake.scoreBreakdown.wasoScore ?? 0).toBeLessThan(
      lowAwake.scoreBreakdown.wasoScore ?? 0
    );
  });

  test('14) J-curve: 9.5h -> lower TST score than 7.5h', () => {
    const sevenPointFive = calculateSleepScore({
      current: makeRecord({
        durationMinutes: 450,
        deepSleepMinutes: 90,
        remSleepMinutes: 99,
        lightSleepMinutes: 261,
        awakeSleepMinutes: 20,
        startTime: '2026-02-01T23:00:00.000Z',
        endTime: '2026-02-02T06:50:00.000Z',
      }),
      history: [],
      userProfile: { age: 30, sleepGoalMinutes: 480, chronotype: 'intermediate' },
    });
    const ninePointFive = calculateSleepScore({
      current: makeRecord({
        durationMinutes: 570,
        deepSleepMinutes: 100,
        remSleepMinutes: 120,
        lightSleepMinutes: 350,
        awakeSleepMinutes: 30,
        startTime: '2026-02-01T22:00:00.000Z',
        endTime: '2026-02-02T07:30:00.000Z',
      }),
      history: [],
      userProfile: { age: 30, sleepGoalMinutes: 480, chronotype: 'intermediate' },
    });

    expect(ninePointFive.scoreBreakdown.tstScore ?? 0).toBeLessThan(
      sevenPointFive.scoreBreakdown.tstScore ?? 0
    );
  });
});
