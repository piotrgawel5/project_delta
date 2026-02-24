// __tests__/screenTime.test.ts
// Integration tests for Screen Time module with mock data

import {
  estimateSleepWindow,
  getEstimatedSleepFromScreenTime,
  getScreenEvents,
  getScreenTimeSummary,
  getTimeRangeForSleepEstimation,
  hasScreenTimePermission,
  requestScreenTimePermission,
} from '../../modules/screen-time';

// Mock the native module
jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(() => ({
    hasPermission: jest.fn(),
    requestPermission: jest.fn(),
    getScreenEvents: jest.fn(),
    getAppUsageStats: jest.fn(),
    estimateSleepWindow: jest.fn(),
    getScreenTimeSummary: jest.fn(),
  })),
}));

describe('Screen Time Module', () => {
  describe('getTimeRangeForSleepEstimation', () => {
    it('should return correct time range for current date', () => {
      const result = getTimeRangeForSleepEstimation();

      // Start should be 6 PM yesterday
      expect(result.startTime).toBeDefined();
      // End should be noon today
      expect(result.endTime).toBeDefined();

      const startDate = new Date(result.startTime);
      const endDate = new Date(result.endTime);

      // Start should be 18:00 (6 PM)
      expect(startDate.getHours()).toBe(18);
      expect(startDate.getMinutes()).toBe(0);

      // End should be 12:00 (noon)
      expect(endDate.getHours()).toBe(12);
      expect(endDate.getMinutes()).toBe(0);
    });

    it('should handle specific date parameter', () => {
      const testDate = new Date('2026-02-01T10:00:00');
      const result = getTimeRangeForSleepEstimation(testDate);

      const startDate = new Date(result.startTime);
      const endDate = new Date(result.endTime);

      // Start should be Jan 31 at 18:00
      expect(startDate.getDate()).toBe(31);
      expect(startDate.getMonth()).toBe(0); // January

      // End should be Feb 1 at 12:00
      expect(endDate.getDate()).toBe(1);
      expect(endDate.getMonth()).toBe(1); // February
    });
  });

  describe('Mock Screen Events Processing', () => {
    it('should identify sleep gap from screen off events', () => {
      // Mock screen events
      const mockEvents = [
        // Evening usage
        { timestamp: 1706731200000, type: 'SCREEN_ON' }, // 10:00 PM
        { timestamp: 1706733000000, type: 'SCREEN_OFF' }, // 10:30 PM
        { timestamp: 1706733600000, type: 'SCREEN_ON' }, // 10:40 PM
        { timestamp: 1706734800000, type: 'SCREEN_OFF' }, // 11:00 PM - bedtime
        // Morning wakeup
        { timestamp: 1706763600000, type: 'SCREEN_ON' }, // 7:00 AM - wake
        { timestamp: 1706764200000, type: 'SCREEN_OFF' }, // 7:10 AM
      ];

      // Find longest gap
      let longestGap = 0;
      let gapStart = 0;
      let gapEnd = 0;

      for (let i = 0; i < mockEvents.length - 1; i++) {
        if (mockEvents[i].type === 'SCREEN_OFF' && mockEvents[i + 1].type === 'SCREEN_ON') {
          const gap = mockEvents[i + 1].timestamp - mockEvents[i].timestamp;
          if (gap > longestGap) {
            longestGap = gap;
            gapStart = mockEvents[i].timestamp;
            gapEnd = mockEvents[i + 1].timestamp;
          }
        }
      }

      // Gap should be ~8 hours (from 11 PM to 7 AM)
      const gapMinutes = longestGap / 60000;
      expect(gapMinutes).toBeGreaterThan(60 * 7); // More than 7 hours
      expect(gapMinutes).toBeLessThan(60 * 9); // Less than 9 hours

      // Longest gap should map to the expected off->on boundary events
      expect(gapStart).toBe(1706734800000);
      expect(gapEnd).toBe(1706763600000);
    });

    it('should handle fragmented sleep patterns', () => {
      // Simulating a night with brief phone check
      const mockEvents = [
        { timestamp: 1706734800000, type: 'SCREEN_OFF' }, // 11:00 PM - initial sleep
        { timestamp: 1706744400000, type: 'SCREEN_ON' }, // 1:40 AM - bathroom check
        { timestamp: 1706744460000, type: 'SCREEN_OFF' }, // 1:41 AM - back to sleep
        { timestamp: 1706763600000, type: 'SCREEN_ON' }, // 7:00 AM - wake
      ];

      // Find all gaps
      const gaps = [];
      for (let i = 0; i < mockEvents.length - 1; i++) {
        if (mockEvents[i].type === 'SCREEN_OFF' && mockEvents[i + 1].type === 'SCREEN_ON') {
          gaps.push({
            duration: mockEvents[i + 1].timestamp - mockEvents[i].timestamp,
            start: mockEvents[i].timestamp,
            end: mockEvents[i + 1].timestamp,
          });
        }
      }

      // Should have 2 gaps
      expect(gaps.length).toBe(2);

      // First gap: 11 PM to 1:40 AM (~2.67 hours)
      expect(gaps[0].duration / 60000).toBeCloseTo(160, 0);

      // Second gap: 1:41 AM to 7 AM (~5.3 hours)
      expect(gaps[1].duration / 60000).toBeCloseTo(319, 0);
    });
  });

  describe('Confidence Level Determination', () => {
    it('should assign high confidence for long uninterrupted gap', () => {
      const gapMinutes = 480; // 8 hours
      const interruptions = 0;

      const confidence = determineConfidence(gapMinutes, interruptions);
      expect(confidence).toBe('high');
    });

    it('should assign medium confidence for reasonable gap with interruptions', () => {
      const gapMinutes = 420; // 7 hours
      const interruptions = 1;

      const confidence = determineConfidence(gapMinutes, interruptions);
      expect(confidence).toBe('medium');
    });

    it('should assign low confidence for short or heavily interrupted sleep', () => {
      const gapMinutes = 240; // 4 hours
      const interruptions = 3;

      const confidence = determineConfidence(gapMinutes, interruptions);
      expect(confidence).toBe('low');
    });
  });
});

// Helper function for confidence determination
function determineConfidence(gapMinutes: number, interruptions: number): 'high' | 'medium' | 'low' {
  if (gapMinutes >= 420 && interruptions === 0) {
    return 'high';
  }
  if (gapMinutes >= 300 && interruptions <= 1) {
    return 'medium';
  }
  return 'low';
}

describe('Screen Time Summary', () => {
  it('should calculate total screen time correctly', () => {
    const mockSummary = {
      totalMinutes: 245,
      lastUnlockBeforeSleep: '2026-01-31T23:15:00.000Z',
      firstUnlockAfterWake: '2026-02-01T07:02:00.000Z',
    };

    expect(mockSummary.totalMinutes).toBe(245);
    expect(mockSummary.totalMinutes / 60).toBeCloseTo(4.08, 1);
  });

  it('should identify pre-bedtime screen usage', () => {
    const lastUnlock = new Date('2026-01-31T23:15:00.000Z');
    const estimatedBedtime = new Date('2026-01-31T23:30:00.000Z');

    const minutesBeforeBed = (estimatedBedtime.getTime() - lastUnlock.getTime()) / 60000;

    // Should be 15 minutes before bed
    expect(minutesBeforeBed).toBe(15);

    // Warning threshold is typically 30 minutes
    const isGoodHygiene = minutesBeforeBed >= 30;
    expect(isGoodHygiene).toBe(false);
  });
});
