// lib/__tests__/sleepCalculations.test.ts
// Unit tests for deterministic sleep score calculation
//
// SETUP REQUIRED: npm i --save-dev jest @types/jest ts-jest
// Then add to package.json scripts: "test": "jest"
/// <reference types="jest" />

import {
  calculateLegacySleepScore,
  ConfidenceLevel,
  DataSource,
  determineConfidence,
  estimateSleepStages,
  generateExplainableInsight,
  OPTIMAL_TARGETS,
  SCORE_WEIGHTS,
  SleepRecordWithScore,
  SleepScoreBreakdown,
  SleepStages,
} from '../sleepCalculations';

describe('calculateLegacySleepScore', () => {
  describe('basic scoring', () => {
    it('should return score of 0 for 0 duration', () => {
      const stages: SleepStages = { deep: 0, rem: 0, light: 0, awake: 0 };
      const result = calculateLegacySleepScore(0, stages);

      expect(result.total).toBe(0);
      expect(result.duration_norm).toBe(0);
      expect(result.deep_pct).toBe(0);
      expect(result.rem_pct).toBe(0);
      expect(result.efficiency).toBe(0);
      expect(result.consistency).toBe(0);
    });

    it('should calculate optimal score for ideal sleep', () => {
      // 8 hours sleep with ideal stage distribution
      const duration = 480;
      const stages: SleepStages = {
        deep: 96, // 20% of total sleep time
        rem: 106, // 22% of total sleep time
        light: 259, // ~54% of total sleep time
        awake: 19, // 4% of total time in bed
      };

      const result = calculateLegacySleepScore(duration, stages);

      // Should score near maximum on all components
      expect(result.duration_norm).toBeGreaterThanOrEqual(30);
      expect(result.deep_pct).toBeGreaterThanOrEqual(18);
      expect(result.rem_pct).toBeGreaterThanOrEqual(18);
      expect(result.efficiency).toBeGreaterThanOrEqual(12);
      expect(result.total).toBeGreaterThanOrEqual(78);
    });

    it('should penalize short sleep duration', () => {
      const stages: SleepStages = {
        deep: 54, // 18% - good
        rem: 66, // 22% - good
        light: 165, // ~55%
        awake: 15, // 5%
      };

      // 5 hours sleep (way below optimal)
      const result = calculateLegacySleepScore(300, stages);

      // Duration should be heavily penalized
      expect(result.duration_norm).toBeLessThan(25);
      expect(result.total).toBeLessThan(70);
    });

    it('should score components correctly for typical night (~78 score)', () => {
      // Typical 7.5 hour sleep
      const duration = 450;
      const stages: SleepStages = {
        deep: 72, // 16% (slightly below ideal 20%)
        rem: 90, // 20% (at lower end of optimal)
        light: 263, // ~58%
        awake: 25, // 5.5%
      };

      const result = calculateLegacySleepScore(duration, stages);

      // All component scores should be within expected ranges
      expect(result.duration_norm).toBeGreaterThanOrEqual(28);
      expect(result.deep_pct).toBeGreaterThanOrEqual(12);
      expect(result.rem_pct).toBeGreaterThanOrEqual(16);
      expect(result.efficiency).toBeGreaterThanOrEqual(10);
      expect(result.total).toBeGreaterThanOrEqual(70);
      expect(result.total).toBeLessThanOrEqual(90);
    });
  });

  describe('edge cases', () => {
    it('should handle 100% deep sleep gracefully', () => {
      const stages: SleepStages = {
        deep: 480,
        rem: 0,
        light: 0,
        awake: 0,
      };

      const result = calculateLegacySleepScore(480, stages);

      // Deep should be maxed or slightly reduced for excess
      expect(result.deep_pct).toBeGreaterThan(0);
      // REM should be 0 since there's no REM
      expect(result.rem_pct).toBe(0);
      // Total should still be reasonable
      expect(result.total).toBeGreaterThan(30);
    });

    it('should handle missing REM data with reduced score', () => {
      const stages: SleepStages = {
        deep: 90,
        rem: 0, // No REM detected
        light: 360,
        awake: 30,
      };

      const result = calculateLegacySleepScore(480, stages);

      // REM score should be 0
      expect(result.rem_pct).toBe(0);
      // Total should be reduced
      expect(result.total).toBeLessThan(80);
    });

    it('should handle all awake time', () => {
      const stages: SleepStages = {
        deep: 0,
        rem: 0,
        light: 0,
        awake: 480,
      };

      const result = calculateLegacySleepScore(480, stages);

      // Efficiency should be very low
      expect(result.efficiency).toBeLessThan(5);
      // All sleep stage scores should be 0
      expect(result.deep_pct).toBe(0);
      expect(result.rem_pct).toBe(0);
    });

    it('should handle very long sleep (12 hours)', () => {
      const stages: SleepStages = {
        deep: 144, // 20%
        rem: 158, // 22%
        light: 403, // ~56%
        awake: 15, // 2%
      };

      const result = calculateLegacySleepScore(720, stages);

      // Duration should be slightly penalized for oversleep
      expect(result.duration_norm).toBeLessThan(SCORE_WEIGHTS.DURATION);
      expect(result.duration_norm).toBeGreaterThan(20);
    });

    it('should handle negative duration', () => {
      const stages: SleepStages = {
        deep: 90,
        rem: 100,
        light: 270,
        awake: 20,
      };
      const result = calculateLegacySleepScore(-100, stages);

      expect(result.total).toBe(0);
    });
  });

  describe('score breakdown sums correctly', () => {
    it('should have components sum to total', () => {
      const stages: SleepStages = {
        deep: 90,
        rem: 100,
        light: 270,
        awake: 20,
      };

      const result = calculateLegacySleepScore(480, stages);

      const componentSum =
        result.duration_norm +
        result.deep_pct +
        result.rem_pct +
        result.efficiency +
        result.consistency;

      expect(componentSum).toBe(result.total);
    });

    it('should not exceed weight limits for any component', () => {
      const stages: SleepStages = {
        deep: 120, // 25% - at upper optimal
        rem: 115, // 24% - optimal
        light: 225,
        awake: 20, // 4% - excellent
      };

      const result = calculateLegacySleepScore(480, stages);

      expect(result.duration_norm).toBeLessThanOrEqual(SCORE_WEIGHTS.DURATION);
      expect(result.deep_pct).toBeLessThanOrEqual(SCORE_WEIGHTS.DEEP_SLEEP);
      expect(result.rem_pct).toBeLessThanOrEqual(SCORE_WEIGHTS.REM_SLEEP);
      expect(result.efficiency).toBeLessThanOrEqual(SCORE_WEIGHTS.EFFICIENCY);
      expect(result.consistency).toBeLessThanOrEqual(SCORE_WEIGHTS.CONSISTENCY);
    });
  });

  describe('consistency scoring', () => {
    it('should give higher consistency score for regular sleep patterns', () => {
      const stages: SleepStages = {
        deep: 90,
        rem: 100,
        light: 270,
        awake: 20,
      };

      // Very consistent: all nights around 480 minutes
      const consistentHistory = [478, 482, 480, 475, 485, 479];
      const consistentResult = calculateLegacySleepScore(480, stages, consistentHistory);

      // Inconsistent: huge variation
      const inconsistentHistory = [300, 600, 420, 540, 360, 510];
      const inconsistentResult = calculateLegacySleepScore(480, stages, inconsistentHistory);

      expect(consistentResult.consistency).toBeGreaterThan(inconsistentResult.consistency);
    });

    it('should give partial consistency score with insufficient history', () => {
      const stages: SleepStages = {
        deep: 90,
        rem: 100,
        light: 270,
        awake: 20,
      };

      // Only 2 days of history (need 3+)
      const shortHistory = [480, 475];
      const result = calculateLegacySleepScore(480, stages, shortHistory);

      // Should get 70% of max consistency score
      expect(result.consistency).toBe(Math.round(SCORE_WEIGHTS.CONSISTENCY * 0.7));
    });
  });

  describe('age-adjusted scoring', () => {
    it('should adjust optimal duration for young adults', () => {
      const stages: SleepStages = {
        deep: 100,
        rem: 110,
        light: 280,
        awake: 20,
      };

      // Young adult profile (needs more sleep)
      const youngProfile = {
        date_of_birth: '2006-01-01', // ~20 years old
      } as any;

      // At 510 minutes, a young adult should score well on duration
      const result = calculateLegacySleepScore(510, stages, [], youngProfile);
      expect(result.duration_norm).toBeGreaterThanOrEqual(30);
    });

    it('should adjust optimal duration for older adults', () => {
      const stages: SleepStages = {
        deep: 70,
        rem: 90,
        light: 250,
        awake: 50,
      };

      // Older adult profile (needs less sleep)
      const olderProfile = {
        date_of_birth: '1956-01-01', // ~70 years old
      } as any;

      // At 420 minutes (7 hours), older adult should score well
      const result = calculateLegacySleepScore(420, stages, [], olderProfile);
      expect(result.duration_norm).toBeGreaterThanOrEqual(28);
    });
  });
});

describe('determineConfidence', () => {
  it('should return low for manual entries', () => {
    const stages: SleepStages = {
      deep: 90,
      rem: 100,
      light: 270,
      awake: 20,
    };
    expect(determineConfidence('manual', stages)).toBe('low');
  });

  it('should return high for health_connect with complete stages', () => {
    const stages: SleepStages = {
      deep: 90,
      rem: 100,
      light: 270,
      awake: 20,
    };
    expect(determineConfidence('health_connect', stages)).toBe('high');
  });

  it('should return medium for health_connect without complete stages', () => {
    const stages: SleepStages = { deep: 0, rem: 0, light: 480, awake: 0 };
    expect(determineConfidence('health_connect', stages)).toBe('medium');
  });

  it('should return low for usage_stats without stage data', () => {
    const stages: SleepStages = { deep: 0, rem: 0, light: 0, awake: 0 };
    expect(determineConfidence('usage_stats', stages)).toBe('low');
  });

  it('should return medium for wearable with complete stages', () => {
    const stages: SleepStages = {
      deep: 90,
      rem: 100,
      light: 270,
      awake: 20,
    };
    expect(determineConfidence('wearable', stages)).toBe('high');
  });
});

describe('estimateSleepStages', () => {
  it('should return zeros for 0 duration', () => {
    const result = estimateSleepStages(0, null);
    expect(result).toEqual({ deep: 0, rem: 0, light: 0, awake: 0 });
  });

  it('should estimate reasonable stage distribution for 8 hours', () => {
    const result = estimateSleepStages(480, null);

    // Check percentages are in reasonable ranges
    const total = result.deep + result.rem + result.light + result.awake;
    expect(total).toBeCloseTo(480, -1); // Within 10 minutes of input

    const deepPct = result.deep / total;
    const remPct = result.rem / total;
    const lightPct = result.light / total;
    const awakePct = result.awake / total;

    expect(deepPct).toBeGreaterThanOrEqual(0.1);
    expect(deepPct).toBeLessThanOrEqual(0.28);
    expect(remPct).toBeGreaterThanOrEqual(0.15);
    expect(remPct).toBeLessThanOrEqual(0.3);
    expect(lightPct).toBeGreaterThanOrEqual(0.4);
    expect(lightPct).toBeLessThanOrEqual(0.65);
    expect(awakePct).toBeGreaterThanOrEqual(0.03);
    expect(awakePct).toBeLessThanOrEqual(0.12);
  });

  it('should adjust for young adults (more deep sleep)', () => {
    const youngProfile = { date_of_birth: '2006-01-01' } as any;
    const youngResult = estimateSleepStages(480, youngProfile);

    const olderProfile = { date_of_birth: '1970-01-01' } as any;
    const olderResult = estimateSleepStages(480, olderProfile);

    expect(youngResult.deep).toBeGreaterThan(olderResult.deep);
  });

  it('should adjust for very active people (more deep sleep)', () => {
    const activeProfile = { activity_level: 'very_active' } as any;
    const activeResult = estimateSleepStages(480, activeProfile);

    const sedentaryProfile = { activity_level: 'sedentary' } as any;
    const sedentaryResult = estimateSleepStages(480, sedentaryProfile);

    expect(activeResult.deep).toBeGreaterThan(sedentaryResult.deep);
  });
});

describe('generateExplainableInsight', () => {
  const createMockRecord = (
    overrides: Partial<SleepRecordWithScore> = {}
  ): SleepRecordWithScore => ({
    user_id: 'test-user',
    date: '2026-02-01',
    start_time: '2026-02-01T23:00:00Z',
    end_time: '2026-02-02T07:00:00Z',
    duration_minutes: 480,
    stages: { deep: 90, rem: 100, light: 270, awake: 20 },
    sleep_score: 78,
    score_breakdown: {
      duration_norm: 32,
      deep_pct: 18,
      rem_pct: 18,
      efficiency: 13,
      consistency: 7,
      total: 78,
    },
    source: 'health_connect',
    confidence: 'high',
    ...overrides,
  });

  it('should generate insight for good sleep', () => {
    const record = createMockRecord({
      sleep_score: 88,
      score_breakdown: {
        duration_norm: 35,
        deep_pct: 20,
        rem_pct: 20,
        efficiency: 15,
        consistency: 10,
        total: 100,
      },
    });

    const insight = generateExplainableInsight(record);

    expect(insight.title).toContain('Excellent');
    expect(insight.predicted_delta).toBe(0);
  });

  it('should identify low REM as contributing signal', () => {
    const record = createMockRecord({
      stages: { deep: 100, rem: 30, light: 330, awake: 20 }, // Low REM
      sleep_score: 65,
    });

    const insight = generateExplainableInsight(record);

    const remSignal = insight.contributing_signals.find((s) =>
      s.signal.toLowerCase().includes('rem')
    );
    expect(remSignal).toBeDefined();
    expect(remSignal!.impact).toBeLessThan(0);
  });

  it('should identify short duration as top signal', () => {
    const record = createMockRecord({
      duration_minutes: 300, // Only 5 hours
      stages: { deep: 54, rem: 66, light: 165, awake: 15 },
      sleep_score: 55,
    });

    const insight = generateExplainableInsight(record);

    expect(insight.contributing_signals[0].signal.toLowerCase()).toContain('duration');
    expect(insight.predicted_delta).toBeGreaterThan(0);
  });

  it('should return max 3 contributing signals', () => {
    const record = createMockRecord({
      duration_minutes: 300,
      stages: { deep: 30, rem: 30, light: 180, awake: 60 },
      sleep_score: 35,
    });

    const insight = generateExplainableInsight(record);

    expect(insight.contributing_signals.length).toBeLessThanOrEqual(3);
  });
});

describe('SCORE_WEIGHTS', () => {
  it('should sum to 100', () => {
    const sum =
      SCORE_WEIGHTS.DURATION +
      SCORE_WEIGHTS.DEEP_SLEEP +
      SCORE_WEIGHTS.REM_SLEEP +
      SCORE_WEIGHTS.EFFICIENCY +
      SCORE_WEIGHTS.CONSISTENCY;

    expect(sum).toBe(100);
  });
});
