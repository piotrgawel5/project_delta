/// <reference types="jest" />

import { SleepRecord, SleepScoringInput } from '@shared';
import { calculateSleepScore } from '../sleepAnalysis';

const fixedDate = new Date('2026-02-01T10:00:00.000Z');

function makeRecord(overrides: Partial<SleepRecord> = {}): SleepRecord {
  return {
    id: 'record-1',
    date: '2026-02-01',
    startTime: '2026-02-01T23:00:00.000Z',
    endTime: '2026-02-02T07:00:00.000Z',
    durationMinutes: 480,
    deepSleepMinutes: 96,
    remSleepMinutes: 106,
    lightSleepMinutes: 258,
    awakeSleepMinutes: 20,
    source: 'health_connect',
    confidence: 'high',
    estimatedBedtime: '2026-02-01T23:00:00.000Z',
    estimatedWakeup: '2026-02-02T07:00:00.000Z',
    screenTimeSummary: null,
    ...overrides,
  };
}

function makeInput(
  currentOverrides: Partial<SleepRecord> = {},
  history: SleepRecord[] = [],
  profile: SleepScoringInput['userProfile'] = {
    age: 28,
    chronotype: 'intermediate',
    sleepGoalMinutes: 480,
  }
): SleepScoringInput {
  return {
    current: makeRecord(currentOverrides),
    history,
    userProfile: profile,
  };
}

describe('calculateSleepScore', () => {
  test('Perfect night -> score > 90', () => {
    const input = makeInput();
    const { sleepScore } = calculateSleepScore(input, fixedDate);
    expect(sleepScore).toBeGreaterThan(90);
  });

  test('4h night -> score 40-58', () => {
    const input = makeInput({
      durationMinutes: 240,
      deepSleepMinutes: 48,
      remSleepMinutes: 53,
      lightSleepMinutes: 119,
      awakeSleepMinutes: 20,
      startTime: '2026-02-01T01:00:00.000Z',
      endTime: '2026-02-01T05:00:00.000Z',
    });
    const { sleepScore } = calculateSleepScore(input, fixedDate);
    expect(sleepScore).toBeGreaterThanOrEqual(40);
    expect(sleepScore).toBeLessThanOrEqual(58);
  });

  test('Stages null + manual source -> confidence low, score < 65', () => {
    const input = makeInput({
      source: 'manual',
      confidence: 'low',
      deepSleepMinutes: null,
      remSleepMinutes: null,
      lightSleepMinutes: null,
      awakeSleepMinutes: null,
    });
    const { sleepScore, scoreBreakdown } = calculateSleepScore(input, fixedDate);
    expect(scoreBreakdown.confidence).toBe('low');
    expect(sleepScore).toBeLessThan(65);
  });

  test('65-year-old with 11% deep -> deep component score > 0.70', () => {
    const input = makeInput(
      {
        durationMinutes: 420,
        deepSleepMinutes: 46,
        remSleepMinutes: 80,
        lightSleepMinutes: 264,
        awakeSleepMinutes: 30,
      },
      [],
      { age: 66, chronotype: 'intermediate', sleepGoalMinutes: 420 }
    );
    const { scoreBreakdown } = calculateSleepScore(input, fixedDate);
    expect(scoreBreakdown.components.deepSleep.normalised).toBeGreaterThan(0.7);
  });

  test('Chronic debt: 6 nights at 5h then 1 night at 8h -> score < 85', () => {
    const debtHistory = Array.from({ length: 6 }).map((_, i) =>
      makeRecord({
        id: `h-${i}`,
        date: `2026-01-${20 + i}`,
        durationMinutes: 300,
        startTime: '2026-01-20T00:00:00.000Z',
        endTime: '2026-01-20T05:00:00.000Z',
        deepSleepMinutes: 45,
        remSleepMinutes: 60,
        lightSleepMinutes: 180,
        awakeSleepMinutes: 15,
      })
    );
    const input = makeInput({}, debtHistory);
    const { sleepScore } = calculateSleepScore(input, fixedDate);
    expect(sleepScore).toBeLessThan(85);
  });

  test('Evening chronotype + 2h bedtime shift -> social_jet_lag flag present', () => {
    const history = [
      makeRecord({ id: 'h1', startTime: '2026-01-25T22:00:00.000Z' }),
      makeRecord({ id: 'h2', startTime: '2026-01-26T01:00:00.000Z' }),
      makeRecord({ id: 'h3', startTime: '2026-01-27T22:30:00.000Z' }),
      makeRecord({ id: 'h4', startTime: '2026-01-28T01:30:00.000Z' }),
      makeRecord({ id: 'h5', startTime: '2026-01-29T22:10:00.000Z' }),
      makeRecord({ id: 'h6', startTime: '2026-01-30T01:45:00.000Z' }),
    ];
    const input = makeInput({ startTime: '2026-02-01T00:30:00.000Z' }, history, {
      age: 28,
      chronotype: 'evening',
      sleepGoalMinutes: 480,
    });
    const { scoreBreakdown } = calculateSleepScore(input, fixedDate);
    expect(scoreBreakdown.flags).toContain('social_jet_lag');
  });

  test('usage_stats source -> source_low_reliability flag, score dampened', () => {
    const healthInput = makeInput({ source: 'health_connect', confidence: 'high' });
    const usageInput = makeInput({ source: 'usage_stats', confidence: 'low' });

    const healthResult = calculateSleepScore(healthInput, fixedDate);
    const usageResult = calculateSleepScore(usageInput, fixedDate);

    expect(usageResult.scoreBreakdown.flags).toContain('source_low_reliability');
    expect(Math.abs(usageResult.sleepScore - 50)).toBeLessThan(
      Math.abs(healthResult.sleepScore - 50)
    );
  });

  test('All null -> score 0, confidence low, data_incomplete_stages flag', () => {
    const input = makeInput({
      durationMinutes: null,
      startTime: null,
      endTime: null,
      deepSleepMinutes: null,
      remSleepMinutes: null,
      lightSleepMinutes: null,
      awakeSleepMinutes: null,
      confidence: 'low',
      source: 'manual',
    });
    const { sleepScore, scoreBreakdown } = calculateSleepScore(input, fixedDate);
    expect(sleepScore).toBe(0);
    expect(scoreBreakdown.confidence).toBe('low');
    expect(scoreBreakdown.flags).toContain('data_incomplete_stages');
  });

  test('Weights sum to 1.0 within floating point tolerance', () => {
    const input = makeInput();
    const { scoreBreakdown } = calculateSleepScore(input, fixedDate);
    const sum = Object.values(scoreBreakdown.weights).reduce((acc, value) => acc + value, 0);
    expect(sum).toBeCloseTo(1.0, 6);
  });

  test('Deterministic: same input -> identical output', () => {
    const input = makeInput();
    const r1 = calculateSleepScore(input, fixedDate);
    const r2 = calculateSleepScore(input, fixedDate);
    expect(r1.sleepScore).toBe(r2.sleepScore);
    expect(JSON.stringify(r1.scoreBreakdown)).toBe(JSON.stringify(r2.scoreBreakdown));
  });
});
