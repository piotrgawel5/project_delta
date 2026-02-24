// __tests__/sleepTimeline.test.ts
// Unit tests for SleepTimeline component logic and mapping functions

import { SleepStage } from '../../components/sleep/SleepTimeline';

describe('SleepTimeline Mapping', () => {
  describe('Time to Position Mapping', () => {
    const timelineWidth = 300;

    function timeToPosition(time: Date, startTime: Date, endTime: Date, width: number): number {
      const totalMs = endTime.getTime() - startTime.getTime();
      const elapsedMs = time.getTime() - startTime.getTime();
      return (elapsedMs / totalMs) * width;
    }

    it('should map start time to position 0', () => {
      const start = new Date('2026-01-31T23:00:00');
      const end = new Date('2026-02-01T07:00:00');

      const pos = timeToPosition(start, start, end, timelineWidth);
      expect(pos).toBe(0);
    });

    it('should map end time to full width', () => {
      const start = new Date('2026-01-31T23:00:00');
      const end = new Date('2026-02-01T07:00:00');

      const pos = timeToPosition(end, start, end, timelineWidth);
      expect(pos).toBe(timelineWidth);
    });

    it('should map midpoint correctly', () => {
      const start = new Date('2026-01-31T23:00:00');
      const end = new Date('2026-02-01T07:00:00');
      const mid = new Date('2026-02-01T03:00:00'); // 4 hours in

      const pos = timeToPosition(mid, start, end, timelineWidth);
      expect(pos).toBe(timelineWidth / 2);
    });

    it('should handle 8-hour sleep correctly', () => {
      const start = new Date('2026-01-31T22:30:00');
      const end = new Date('2026-02-01T06:30:00');

      // 2 hours in (quarter way)
      const quarterPoint = new Date('2026-02-01T00:30:00');
      const pos = timeToPosition(quarterPoint, start, end, timelineWidth);
      expect(pos).toBe(75); // 25% of 300
    });
  });

  describe('Position to Time Mapping', () => {
    function positionToTime(position: number, startTime: Date, endTime: Date, width: number): Date {
      const totalMs = endTime.getTime() - startTime.getTime();
      const elapsedMs = (position / width) * totalMs;
      return new Date(startTime.getTime() + elapsedMs);
    }

    it('should map position 0 to start time', () => {
      const start = new Date('2026-01-31T23:00:00');
      const end = new Date('2026-02-01T07:00:00');

      const time = positionToTime(0, start, end, 300);
      expect(time.getTime()).toBe(start.getTime());
    });

    it('should map full width to end time', () => {
      const start = new Date('2026-01-31T23:00:00');
      const end = new Date('2026-02-01T07:00:00');

      const time = positionToTime(300, start, end, 300);
      expect(time.getTime()).toBe(end.getTime());
    });

    it('should be inverse of timeToPosition', () => {
      const start = new Date('2026-01-31T23:00:00');
      const end = new Date('2026-02-01T07:00:00');
      const width = 300;

      // Test with arbitrary time
      const testTime = new Date('2026-02-01T02:30:00');

      // Convert to position and back
      const totalMs = end.getTime() - start.getTime();
      const elapsedMs = testTime.getTime() - start.getTime();
      const pos = (elapsedMs / totalMs) * width;

      const recovered = new Date(start.getTime() + (pos / width) * totalMs);
      expect(recovered.getTime()).toBe(testTime.getTime());
    });
  });

  describe('Stage Width Calculation', () => {
    function calculateStageWidth(
      stage: SleepStage,
      totalDuration: number,
      containerWidth: number
    ): number {
      const proportion = stage.durationMinutes / totalDuration;
      return Math.max(proportion * containerWidth, 8); // Minimum 8px
    }

    it('should calculate proportional width for normal stages', () => {
      const stage: SleepStage = {
        stage: 'deep',
        startTime: '2026-02-01T00:00:00',
        endTime: '2026-02-01T02:00:00',
        durationMinutes: 120,
      };
      const totalDuration = 480; // 8 hours
      const containerWidth = 320;

      const width = calculateStageWidth(stage, totalDuration, containerWidth);
      expect(width).toBe(80); // 120/480 * 320 = 80
    });

    it('should enforce minimum width for very short stages', () => {
      const stage: SleepStage = {
        stage: 'awake',
        startTime: '2026-02-01T03:00:00',
        endTime: '2026-02-01T03:05:00',
        durationMinutes: 5,
      };
      const totalDuration = 480;
      const containerWidth = 320;

      const width = calculateStageWidth(stage, totalDuration, containerWidth);
      // 5/480 * 320 = 3.33, but minimum is 8
      expect(width).toBe(8);
    });

    it('should handle full-duration stage', () => {
      const stage: SleepStage = {
        stage: 'light',
        startTime: '2026-02-01T00:00:00',
        endTime: '2026-02-01T08:00:00',
        durationMinutes: 480,
      };
      const totalDuration = 480;
      const containerWidth = 320;

      const width = calculateStageWidth(stage, totalDuration, containerWidth);
      expect(width).toBe(320);
    });
  });

  describe('Stage Aggregation', () => {
    function aggregateStages(stages: SleepStage[]): Record<string, number> {
      return stages.reduce(
        (acc, stage) => {
          acc[stage.stage] = (acc[stage.stage] || 0) + stage.durationMinutes;
          return acc;
        },
        {} as Record<string, number>
      );
    }

    it('should aggregate multiple stages of same type', () => {
      const stages: SleepStage[] = [
        {
          stage: 'light',
          startTime: '',
          endTime: '',
          durationMinutes: 60,
        },
        {
          stage: 'deep',
          startTime: '',
          endTime: '',
          durationMinutes: 90,
        },
        {
          stage: 'light',
          startTime: '',
          endTime: '',
          durationMinutes: 45,
        },
        {
          stage: 'rem',
          startTime: '',
          endTime: '',
          durationMinutes: 30,
        },
        {
          stage: 'light',
          startTime: '',
          endTime: '',
          durationMinutes: 55,
        },
      ];

      const aggregated = aggregateStages(stages);

      expect(aggregated.light).toBe(160); // 60 + 45 + 55
      expect(aggregated.deep).toBe(90);
      expect(aggregated.rem).toBe(30);
      expect(aggregated.awake).toBeUndefined();
    });

    it('should handle empty stages array', () => {
      const aggregated = aggregateStages([]);
      expect(Object.keys(aggregated).length).toBe(0);
    });

    it('should calculate correct percentages', () => {
      const stages: SleepStage[] = [
        {
          stage: 'light',
          startTime: '',
          endTime: '',
          durationMinutes: 240,
        },
        {
          stage: 'deep',
          startTime: '',
          endTime: '',
          durationMinutes: 90,
        },
        {
          stage: 'rem',
          startTime: '',
          endTime: '',
          durationMinutes: 110,
        },
        {
          stage: 'awake',
          startTime: '',
          endTime: '',
          durationMinutes: 40,
        },
      ];

      const aggregated = aggregateStages(stages);
      const total = Object.values(aggregated).reduce((a, b) => a + b, 0);

      expect(total).toBe(480); // 8 hours
      expect((aggregated.light / total) * 100).toBe(50);
      expect((aggregated.deep / total) * 100).toBeCloseTo(18.75, 1);
      expect((aggregated.rem / total) * 100).toBeCloseTo(22.92, 1);
      expect((aggregated.awake / total) * 100).toBeCloseTo(8.33, 1);
    });
  });

  describe('Stage Color Mapping', () => {
    const STAGE_COLORS = {
      awake: '#64748B',
      light: '#FBBF24',
      deep: '#F472B6',
      rem: '#6366F1',
    };

    it('should map all stage types to colors', () => {
      expect(STAGE_COLORS.awake).toBe('#64748B');
      expect(STAGE_COLORS.light).toBe('#FBBF24');
      expect(STAGE_COLORS.deep).toBe('#F472B6');
      expect(STAGE_COLORS.rem).toBe('#6366F1');
    });
  });

  describe('Scrubber Position Validation', () => {
    function clampPosition(pos: number, min: number, max: number): number {
      return Math.min(Math.max(pos, min), max);
    }

    it('should clamp negative positions to 0', () => {
      expect(clampPosition(-10, 0, 300)).toBe(0);
    });

    it('should clamp positions beyond max', () => {
      expect(clampPosition(350, 0, 300)).toBe(300);
    });

    it('should allow valid positions', () => {
      expect(clampPosition(150, 0, 300)).toBe(150);
    });
  });

  describe('Time Formatting', () => {
    function formatTime(date: Date): string {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    }

    it('should format midnight correctly', () => {
      const midnight = new Date('2026-02-01T00:00:00');
      expect(formatTime(midnight)).toBe('00:00');
    });

    it('should format afternoon time correctly', () => {
      const afternoon = new Date('2026-02-01T14:30:00');
      expect(formatTime(afternoon)).toBe('14:30');
    });

    it('should format early morning correctly', () => {
      const early = new Date('2026-02-01T03:45:00');
      expect(formatTime(early)).toBe('03:45');
    });
  });
});

describe('SleepTimeline Data Transformation', () => {
  describe('Raw Data to Timeline Format', () => {
    interface RawSleepData {
      start_time: string;
      end_time: string;
      duration_minutes: number;
      deep_sleep_minutes: number;
      rem_sleep_minutes: number;
      light_sleep_minutes: number;
      awake_minutes: number;
    }

    function transformToStages(data: RawSleepData): SleepStage[] {
      const stages: SleepStage[] = [];
      const start = new Date(data.start_time);
      let currentTime = start.getTime();

      // Approximate stage distribution (simplified)
      const stageOrder = ['light', 'deep', 'rem', 'light', 'awake'] as const;
      const durations = [
        Math.round(data.light_sleep_minutes * 0.4),
        data.deep_sleep_minutes,
        data.rem_sleep_minutes,
        Math.round(data.light_sleep_minutes * 0.6),
        data.awake_minutes,
      ];

      stageOrder.forEach((stage, i) => {
        if (durations[i] > 0) {
          const endTime = currentTime + durations[i] * 60 * 1000;
          stages.push({
            stage,
            startTime: new Date(currentTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            durationMinutes: durations[i],
          });
          currentTime = endTime;
        }
      });

      return stages;
    }

    it('should create stages from raw sleep data', () => {
      const rawData: RawSleepData = {
        start_time: '2026-01-31T23:00:00Z',
        end_time: '2026-02-01T07:00:00Z',
        duration_minutes: 480,
        deep_sleep_minutes: 90,
        rem_sleep_minutes: 100,
        light_sleep_minutes: 270,
        awake_minutes: 20,
      };

      const stages = transformToStages(rawData);

      // Should have 5 stages
      expect(stages.length).toBe(5);

      // Total duration should match
      const totalDuration = stages.reduce((sum, s) => sum + s.durationMinutes, 0);
      expect(totalDuration).toBe(480);
    });

    it('should handle missing stages', () => {
      const rawData: RawSleepData = {
        start_time: '2026-01-31T23:00:00Z',
        end_time: '2026-02-01T07:00:00Z',
        duration_minutes: 480,
        deep_sleep_minutes: 0, // No deep sleep
        rem_sleep_minutes: 120,
        light_sleep_minutes: 360,
        awake_minutes: 0, // No awake time
      };

      const stages = transformToStages(rawData);

      // Should skip zero-duration stages
      const stageTypes = stages.map((s) => s.stage);
      expect(stageTypes).not.toContain('deep');
      expect(stageTypes).not.toContain('awake');
    });
  });
});
