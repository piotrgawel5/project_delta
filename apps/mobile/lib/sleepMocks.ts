import type { SleepHypnogramData, WeeklySparkEntry } from '@project-delta/shared';

// 4:30 AM = 270 min from midnight, 12:40 PM = 760 min from midnight
// Realistic sleep architecture: heavy deep sleep early, more REM later
export const MOCK_HYPNOGRAM: SleepHypnogramData = {
  sleepOnsetMin: 270,
  wakeMin: 760,
  phases: [
    // Cycle 1 - lots of deep
    { stage: 'light', startMin: 270, durationMin: 12, cycleNumber: 1, confidence: 'high' },
    { stage: 'deep', startMin: 282, durationMin: 50, cycleNumber: 1, confidence: 'high' },
    { stage: 'light', startMin: 332, durationMin: 10, cycleNumber: 1, confidence: 'high' },
    { stage: 'core', startMin: 342, durationMin: 28, cycleNumber: 1, confidence: 'high' },
    // Cycle 2 - still some deep
    { stage: 'awake', startMin: 370, durationMin: 3, cycleNumber: 2, confidence: 'medium' },
    { stage: 'light', startMin: 373, durationMin: 18, cycleNumber: 2, confidence: 'high' },
    { stage: 'deep', startMin: 391, durationMin: 40, cycleNumber: 2, confidence: 'high' },
    { stage: 'light', startMin: 431, durationMin: 14, cycleNumber: 2, confidence: 'high' },
    { stage: 'core', startMin: 445, durationMin: 35, cycleNumber: 2, confidence: 'high' },
    // Cycle 3 - light deep, more core/REM
    { stage: 'light', startMin: 480, durationMin: 20, cycleNumber: 3, confidence: 'medium' },
    { stage: 'deep', startMin: 500, durationMin: 22, cycleNumber: 3, confidence: 'medium' },
    { stage: 'core', startMin: 522, durationMin: 38, cycleNumber: 3, confidence: 'high' },
    { stage: 'awake', startMin: 560, durationMin: 4, cycleNumber: 3, confidence: 'low' },
    // Cycle 4 - mostly light + core
    { stage: 'light', startMin: 564, durationMin: 25, cycleNumber: 4, confidence: 'high' },
    { stage: 'core', startMin: 589, durationMin: 42, cycleNumber: 4, confidence: 'high' },
    { stage: 'light', startMin: 631, durationMin: 18, cycleNumber: 4, confidence: 'medium' },
    // Cycle 5 - late sleep, lots of light/core, brief awake at end
    { stage: 'light', startMin: 649, durationMin: 28, cycleNumber: 5, confidence: 'high' },
    { stage: 'core', startMin: 677, durationMin: 44, cycleNumber: 5, confidence: 'high' },
    { stage: 'light', startMin: 721, durationMin: 25, cycleNumber: 5, confidence: 'medium' },
    { stage: 'awake', startMin: 746, durationMin: 14, cycleNumber: 5, confidence: 'low' },
  ],
};

export const MOCK_WEEKLY_DOTS: WeeklySparkEntry[] = [
  { day: 'M', value: 1, active: true },
  { day: 'T', value: 1, active: true },
  { day: 'W', value: 1, active: true },
  { day: 'T', value: 1, active: true },
  { day: 'F', value: 1, active: true },
  { day: 'S', value: 1, active: true },
  { day: 'S', value: 1, active: true },
];

export const MOCK_WEEKLY_BARS: WeeklySparkEntry[] = [
  { day: 'M', value: 0.5, active: false },
  { day: 'T', value: 0.35, active: false },
  { day: 'W', value: 0.3, active: false },
  { day: 'T', value: 0.55, active: false },
  { day: 'F', value: 0.75, active: false },
  { day: 'S', value: 0.9, active: false },
  { day: 'S', value: 1.0, active: true },
];
