export type DataSource =
  | "health_connect"
  | "digital_wellbeing"
  | "usage_stats"
  | "wearable"
  | "manual";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ScreenTimeSummary {
  totalMinutesLast2Hours?: number;
  blueLight?: boolean;
  lastAppUsedMinutesBeforeBed?: number;
}

export interface SleepRecord {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  deepSleepMinutes: number | null;
  remSleepMinutes: number | null;
  lightSleepMinutes: number | null;
  awakeSleepMinutes: number | null;
  source: DataSource;
  confidence: ConfidenceLevel;
  estimatedBedtime: string | null;
  estimatedWakeup: string | null;
  screenTimeSummary: ScreenTimeSummary | null;
}

export interface UserProfile {
  age?: number;
  chronotype?: "morning" | "intermediate" | "evening";
  sleepGoalMinutes?: number;
}

export interface SleepScoringInput {
  current: SleepRecord;
  history: SleepRecord[];
  userProfile?: UserProfile;
}

export interface AgeNorm {
  idealDurationMin: number;
  minHealthyDurationMin: number;
  deepPctIdeal: number;
  deepPctLow: number;
  deepPctHigh: number;
  remPctIdeal: number;
  remPctLow: number;
  remPctHigh: number;
  efficiencyIdeal: number;
  efficiencyLow: number;
  wasoExpected: number;
  wasoAcceptable: number;
}

export interface UserBaseline {
  avgDurationMin: number;
  avgDeepPct: number;
  avgRemPct: number;
  avgEfficiency: number;
  avgWasoMin: number;
  medianBedtimeMinutesFromMidnight: number;
  medianWakeMinutesFromMidnight: number;
  bedtimeVarianceMinutes: number;
  p25DurationMin: number;
  p75DurationMin: number;
  nightsAnalysed: number;
}

export interface ComponentResult {
  raw: number;
  norm: number;
  normalised: number;
  weight: number;
  contribution: number;
}

export type SleepComponentKey =
  | "duration"
  | "deepSleep"
  | "remSleep"
  | "efficiency"
  | "waso"
  | "consistency"
  | "timing"
  | "screenTime";

export interface ScoreBreakdown {
  score: number;
  confidence: ConfidenceLevel;
  components: {
    duration: ComponentResult;
    deepSleep: ComponentResult;
    remSleep: ComponentResult;
    efficiency: ComponentResult;
    waso: ComponentResult;
    consistency: ComponentResult;
    timing: ComponentResult;
    screenTime: ComponentResult;
  };
  weights: Record<SleepComponentKey, number>;
  adjustments: {
    sourceReliabilityFactor: number;
    dataCompletenessFactor: number;
    chronicDebtPenalty: number;
    ageEfficiencyCorrection: number;
    chronotypeAlignmentDelta: number;
  };
  baseline: UserBaseline;
  ageNorm: AgeNorm;
  flags: string[];
  calculatedAt: string;
}
