import type { CycleDistributorInput, SleepPhaseEvent } from '@shared';
import {
  CYCLE_DISTRIBUTOR_CONSTANTS,
  distributeSleepcycles,
} from '../sleepCycleDistributor';

const BASE_INPUT: CycleDistributorInput = {
  startTime: '2024-01-15T23:30:00.000Z',
  endTime: '2024-01-16T07:30:00.000Z',
  durationMinutes: 480,
  deepSleepMinutes: 85,
  remSleepMinutes: 102,
  lightSleepMinutes: 265,
  awakeSleepMinutes: 28,
  estimatedRestingHR: 55,
  estimatedVO2Max: 46,
  age: 32,
  sex: 'male',
  recentSleepDebt: 0,
  historyNightCount: 10,
};

function requireOutput(input: CycleDistributorInput) {
  const result = distributeSleepcycles(input);
  expect(result).not.toBeNull();
  return result!;
}

function splitMinutesByMidpoint(events: SleepPhaseEvent[], stage: SleepPhaseEvent['stage']) {
  const startMs = new Date(BASE_INPUT.startTime).getTime();
  const midpointMs = startMs + BASE_INPUT.durationMinutes * 30_000;

  let before = 0;
  let after = 0;

  for (const event of events) {
    if (event.stage !== stage) continue;

    const eventStart = new Date(event.startTime).getTime();
    const eventEnd = new Date(event.endTime).getTime();

    const beforeStart = eventStart;
    const beforeEnd = Math.min(eventEnd, midpointMs);
    if (beforeEnd > beforeStart) {
      before += (beforeEnd - beforeStart) / 60_000;
    }

    const afterStart = Math.max(eventStart, midpointMs);
    const afterEnd = eventEnd;
    if (afterEnd > afterStart) {
      after += (afterEnd - afterStart) / 60_000;
    }
  }

  return { before, after };
}

function deepInCycle1(events: SleepPhaseEvent[]): number {
  return events
    .filter((event) => event.cycleNumber === 1 && event.stage === 'deep')
    .reduce((sum, event) => sum + event.durationMinutes, 0);
}

describe('sleepCycleDistributor', () => {
  test('1) Produces valid timeline with front-loaded deep and back-loaded REM', () => {
    const output = requireOutput(BASE_INPUT);
    const { phaseTimeline, estimatedCycles } = output;

    const total = phaseTimeline.reduce((sum, event) => sum + event.durationMinutes, 0);
    expect(Math.abs(total - 480)).toBeLessThanOrEqual(1);

    expect(phaseTimeline[0].stage).toBe('awake');
    expect(phaseTimeline[0].cycleNumber).toBe(0);

    for (let i = 0; i < phaseTimeline.length - 1; i += 1) {
      expect(phaseTimeline[i].endTime).toBe(phaseTimeline[i + 1].startTime);
    }

    expect(estimatedCycles).toBeGreaterThanOrEqual(3);
    expect(estimatedCycles).toBeLessThanOrEqual(6);

    const deepSplit = splitMinutesByMidpoint(phaseTimeline, 'deep');
    const remSplit = splitMinutesByMidpoint(phaseTimeline, 'rem');

    expect(deepSplit.before).toBeGreaterThan(deepSplit.after);
    expect(remSplit.after).toBeGreaterThan(remSplit.before);
  });

  test('2) Null stage totals fall back and still produce a valid timeline', () => {
    const output = requireOutput({
      ...BASE_INPUT,
      deepSleepMinutes: null,
      remSleepMinutes: null,
      lightSleepMinutes: null,
      awakeSleepMinutes: null,
    });

    expect(output.phaseTimeline.length).toBeGreaterThan(0);
    const total = output.phaseTimeline.reduce((sum, event) => sum + event.durationMinutes, 0);
    expect(Math.abs(total - BASE_INPUT.durationMinutes)).toBeLessThanOrEqual(1);
  });

  test('3) Missing startTime returns null', () => {
    const result = distributeSleepcycles({ ...BASE_INPUT, startTime: '' });
    expect(result).toBeNull();
  });

  test('4) Sleep debt 250 increases cycle 1 deep minutes vs no debt', () => {
    const withDebt = requireOutput({ ...BASE_INPUT, recentSleepDebt: 250 });
    const noDebt = requireOutput({ ...BASE_INPUT, recentSleepDebt: 0 });

    expect(deepInCycle1(withDebt.phaseTimeline)).toBeGreaterThan(deepInCycle1(noDebt.phaseTimeline));
  });

  test('5) Age 65 has less cycle 1 deep minutes than age 25', () => {
    const age65 = requireOutput({ ...BASE_INPUT, age: 65 });
    const age25 = requireOutput({ ...BASE_INPUT, age: 25 });

    expect(deepInCycle1(age65.phaseTimeline)).toBeLessThan(deepInCycle1(age25.phaseTimeline));
  });

  test('6) Cycle count scales with duration buckets', () => {
    const duration5h = requireOutput({
      ...BASE_INPUT,
      durationMinutes: 300,
      endTime: new Date(new Date(BASE_INPUT.startTime).getTime() + 300 * 60_000).toISOString(),
    });
    const duration8h = requireOutput({ ...BASE_INPUT, durationMinutes: 480 });
    const duration9h = requireOutput({
      ...BASE_INPUT,
      durationMinutes: 540,
      endTime: new Date(new Date(BASE_INPUT.startTime).getTime() + 540 * 60_000).toISOString(),
    });

    expect(duration5h.estimatedCycles).toBe(3);
    expect(duration8h.estimatedCycles).toBeGreaterThanOrEqual(4);
    expect(duration8h.estimatedCycles).toBeLessThanOrEqual(5);
    expect(duration9h.estimatedCycles).toBeGreaterThanOrEqual(5);
    expect(duration9h.estimatedCycles).toBeLessThanOrEqual(6);
  });

  test('7) All timeline durations are positive integers', () => {
    const output = requireOutput(BASE_INPUT);

    for (const event of output.phaseTimeline) {
      expect(Number.isInteger(event.durationMinutes)).toBe(true);
      expect(event.durationMinutes).toBeGreaterThan(0);
    }
  });

  test('8) algorithmVersion exists and is a positive integer', () => {
    const output = requireOutput(BASE_INPUT);

    expect(Number.isInteger(output.algorithmVersion)).toBe(true);
    expect(output.algorithmVersion).toBeGreaterThan(0);
    expect(output.algorithmVersion).toBe(CYCLE_DISTRIBUTOR_CONSTANTS.ALGO_VERSION);
  });

  test('9) cycleBreakdown length equals estimatedCycles', () => {
    const output = requireOutput(BASE_INPUT);
    expect(output.cycleBreakdown.length).toBe(output.estimatedCycles);
  });

  test('10) Last event endTime matches input endTime within 1 minute tolerance', () => {
    const output = requireOutput(BASE_INPUT);
    const lastEvent = output.phaseTimeline[output.phaseTimeline.length - 1];
    const diffMinutes =
      Math.abs(new Date(lastEvent.endTime).getTime() - new Date(BASE_INPUT.endTime).getTime()) /
      60_000;

    expect(diffMinutes).toBeLessThanOrEqual(1);
  });
});
