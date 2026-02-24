import { describe, expect, it } from '@jest/globals';
import type { SleepHypnogramPhase } from '../sleepHypnogram';
import {
  buildHypnogramGeometry,
  coalescePhases,
  mapTimeToX,
  MERGING_THRESHOLD_MS,
  selectGridIntervalMs,
} from '../sleepHypnogram';

describe('sleepHypnogram utilities', () => {
  const basePhase = (partial: Partial<SleepHypnogramPhase>): SleepHypnogramPhase => ({
    id: partial.id ?? 'p1',
    cycle_number: partial.cycle_number ?? 1,
    stage: partial.stage ?? 'light',
    start_time: partial.start_time ?? '2026-02-01T00:00:00.000Z',
    end_time: partial.end_time ?? '2026-02-01T00:30:00.000Z',
    duration_minutes: partial.duration_minutes ?? 30,
    confidence: partial.confidence ?? 'medium',
  });

  it('maps start and end timestamps to chart bounds', () => {
    const t0 = Date.parse('2026-02-01T00:00:00.000Z');
    const t1 = Date.parse('2026-02-01T08:00:00.000Z');
    expect(mapTimeToX(t0, t0, t1, 320)).toBe(0);
    expect(mapTimeToX(t1, t0, t1, 320)).toBe(320);
  });

  it('selects grid interval based on timeline span', () => {
    const t0 = Date.parse('2026-02-01T00:00:00.000Z');
    expect(selectGridIntervalMs(t0, t0 + 5 * 3_600_000)).toBe(30 * 60_000);
    expect(selectGridIntervalMs(t0, t0 + 10 * 3_600_000)).toBe(60 * 60_000);
    expect(selectGridIntervalMs(t0, t0 + 16 * 3_600_000)).toBe(2 * 60 * 60_000);
  });

  it('coalesces same-stage phases when gap is below threshold', () => {
    const first = basePhase({
      id: 'p1',
      stage: 'light',
      start_time: '2026-02-01T00:00:00.000Z',
      end_time: '2026-02-01T00:20:00.000Z',
    });
    const second = basePhase({
      id: 'p2',
      stage: 'light',
      start_time: new Date(Date.parse(first.end_time) + MERGING_THRESHOLD_MS - 1000).toISOString(),
      end_time: '2026-02-01T00:45:00.000Z',
    });
    const merged = coalescePhases([second, first]);
    expect(merged).toHaveLength(1);
    expect(merged[0].start_time).toBe(first.start_time);
    expect(merged[0].end_time).toBe(second.end_time);
  });

  it('closes tiny transition gaps for adjacent phases', () => {
    const deep = basePhase({
      id: 'p1',
      stage: 'deep',
      start_time: '2026-02-01T00:00:00.000Z',
      end_time: '2026-02-01T01:00:00.000Z',
      confidence: 'high',
    });
    const rem = basePhase({
      id: 'p2',
      stage: 'rem',
      start_time: '2026-02-01T01:00:02.000Z',
      end_time: '2026-02-01T02:00:00.000Z',
      confidence: 'high',
    });
    const [a, b] = coalescePhases([deep, rem]);
    expect(Date.parse(a.end_time)).toBe(Date.parse(b.start_time));
  });

  it('builds geometry with clamped segment width and ticks', () => {
    const phases = [
      basePhase({
        id: 'p1',
        stage: 'awake',
        start_time: '2026-02-01T00:00:00.000Z',
        end_time: '2026-02-01T00:00:10.000Z',
        confidence: 'low',
      }),
    ];
    const geometry = buildHypnogramGeometry({
      phases,
      sessionStart: '2026-02-01T00:00:00.000Z',
      sessionEnd: '2026-02-01T06:00:00.000Z',
      width: 300,
      height: 180,
    });
    expect(geometry.segments).toHaveLength(1);
    expect(geometry.segments[0].width).toBeGreaterThanOrEqual(2);
    expect(geometry.ticks.length).toBeGreaterThan(0);
    expect(geometry.gaps).toHaveLength(0);
  });

  it('collapses abrupt short transitions to dominant neighboring stage', () => {
    const phases = [
      basePhase({
        id: 'a',
        stage: 'deep',
        start_time: '2026-02-01T00:00:00.000Z',
        end_time: '2026-02-01T00:40:00.000Z',
        confidence: 'high',
      }),
      basePhase({
        id: 'b',
        stage: 'awake',
        start_time: '2026-02-01T00:40:00.000Z',
        end_time: '2026-02-01T00:40:08.000Z',
        confidence: 'low',
      }),
      basePhase({
        id: 'c',
        stage: 'deep',
        start_time: '2026-02-01T00:40:08.000Z',
        end_time: '2026-02-01T01:20:00.000Z',
        confidence: 'high',
      }),
    ];
    const collapsed = coalescePhases(phases);
    expect(collapsed.find((phase) => phase.id === 'b')?.stage).toBe('deep');
  });

  it('emits explicit gap and cycle boundary geometry', () => {
    const geometry = buildHypnogramGeometry({
      phases: [
        basePhase({
          id: 'a',
          cycle_number: 1,
          stage: 'light',
          confidence: 'high',
          start_time: '2026-02-01T00:00:00.000Z',
          end_time: '2026-02-01T00:30:00.000Z',
        }),
        basePhase({
          id: 'b',
          cycle_number: 2,
          stage: 'rem',
          confidence: 'low',
          start_time: '2026-02-01T00:35:00.000Z',
          end_time: '2026-02-01T01:00:00.000Z',
        }),
      ],
      sessionStart: '2026-02-01T00:00:00.000Z',
      sessionEnd: '2026-02-01T02:00:00.000Z',
      width: 300,
      height: 180,
    });

    expect(geometry.gaps).toHaveLength(1);
    expect(geometry.gaps[0].lowConfidence).toBe(true);
    expect(geometry.cycleBoundaries).toHaveLength(1);
    expect(geometry.cycleBoundaries[0].cycleNumber).toBe(2);
  });
});
