import {
  calculateWeeklyDelta,
  deriveWeekSeries,
  getHeroGradientStops,
  toBedtimeMinutes,
  toWakeMinutes,
} from '../sleepWeeklyInsights';
import { buildSmoothPath } from '../sleepChartUtils';

describe('sleepWeeklyInsights', () => {
  it('returns null when weekly delta does not have enough prior scores', () => {
    expect(calculateWeeklyDelta(86, [86, null, 80, null, null, 70, null], 0)).toBeNull();
  });

  it('calculates weekly delta against prior available scores', () => {
    expect(calculateWeeklyDelta(90, [80, 82, 84, 90, null, 86, 88], 3)).toBe(7);
  });

  it('derives a Monday to Sunday series across a month boundary', () => {
    const recentHistory = [
      {
        date: '2026-03-30',
        start_time: '2026-03-29T23:30:00',
        end_time: '2026-03-30T07:00:00',
        duration_minutes: 450,
        sleep_score: 79,
      },
      {
        date: '2026-04-01',
        start_time: '2026-03-31T23:15:00',
        end_time: '2026-04-01T06:45:00',
        duration_minutes: 450,
        score_breakdown: { score: 83 },
      },
    ];
    const monthlyData = {
      '2026-04': [
        {
          date: '2026-04-02',
          start_time: '2026-04-01T23:45:00',
          end_time: '2026-04-02T07:10:00',
          duration_minutes: 445,
          sleep_score: 81,
        },
      ],
    };

    const result = deriveWeekSeries(recentHistory, monthlyData, new Date('2026-04-02T12:00:00'));

    expect(result.todayIndex).toBe(3);
    expect(result.durations).toEqual([450, null, 450, 445, null, null, null]);
    expect(result.scores).toEqual([79, null, 83, 81, null, null, null]);
    expect(result.bedtimes[0]).toBe(1410);
    expect(result.wakeTimes[3]).toBe(430);
  });

  it('normalizes bedtime and wake minutes correctly', () => {
    expect(toBedtimeMinutes('2026-03-17T00:30:00')).toBe(1470);
    expect(toWakeMinutes('2026-03-17T07:15:00')).toBe(435);
  });

  it('blends hero gradient primary stop toward the score color', () => {
    expect(getHeroGradientStops('#22c55e')).toEqual({
      primary: '#26a750',
      mid: '#0A1A0E',
      end: '#000000',
    });
  });
});

describe('buildSmoothPath', () => {
  it('returns the expected path for 0, 1, and 2 points', () => {
    expect(buildSmoothPath([])).toBe('');
    expect(buildSmoothPath([{ x: 1, y: 2 }])).toBe('M 1 2');
    expect(
      buildSmoothPath([
        { x: 0, y: 10 },
        { x: 10, y: 20 },
      ])
    ).toBe('M 0 10 L 10 20');
  });

  it('returns a cubic bezier path for 3 or more points', () => {
    expect(
      buildSmoothPath([
        { x: 0, y: 10 },
        { x: 10, y: 20 },
        { x: 20, y: 0 },
      ])
    ).toBe('M 0 10 C 2 12 6 22 10 20 C 14 18 18 4 20 0');
  });
});
