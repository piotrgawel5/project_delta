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
  premiumPrediction?: PremiumSleepPrediction;
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
  efficiencyScore?: number;
  wasoScore?: number;
  tstScore?: number;
  deepScore?: number;
  remScore?: number;
  regularityScore?: number;
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

export interface SleepPhaseEvent {
  stage: "awake" | "light" | "deep" | "rem";
  startTime: string; // ISO — absolute timestamp, not relative offset
  endTime: string; // ISO
  durationMinutes: number;
  cycleNumber: number; // 1-based; 0 = pre-sleep awake
}

// Matches the sleep_phase_timeline table columns exactly
export interface SleepPhaseTimelineRow {
  id: string;
  sleep_data_id: string;
  user_id: string;
  cycle_number: number;
  stage: "awake" | "light" | "deep" | "rem";
  start_time: string; // ISO
  end_time: string; // ISO
  duration_minutes: number;
  confidence: "high" | "medium" | "low";
  generation_v: number;
  created_at: string;
}

export interface CycleBreakdown {
  cycleNumber: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  dominantStage: "deep" | "rem" | "light";
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
}

export interface CycleDistributorInput {
  // From sleep_data record
  startTime: string; // ISO string — required, return null if missing
  endTime: string; // ISO string — required, return null if missing
  durationMinutes: number;
  deepSleepMinutes: number | null;
  remSleepMinutes: number | null;
  lightSleepMinutes: number | null;
  awakeSleepMinutes: number | null;

  // From estimatePhysiology() — always available for premium users
  estimatedRestingHR: number;
  estimatedVO2Max: number;
  age: number;
  sex: "male" | "female" | null;

  // From history computation — optional
  recentSleepDebt?: number; // minutes below 480 goal, avg last 3 nights
  personalDeepRatio?: number; // 0..1, avg last 7 nights
  personalRemRatio?: number; // 0..1
  personalCycleLength?: number; // minutes
  historyNightCount?: number; // for confidence scoring
}

export interface CycleDistributorOutput {
  phaseTimeline: SleepPhaseEvent[];
  estimatedCycles: number;
  cycleBreakdown: CycleBreakdown[];
  confidence: "high" | "medium" | "low";
  algorithmVersion: number;
}

export interface SleepCycleMap {
  estimatedCycles: number;
  // Full flat timeline ordered by startTime — compatible with existing SleepTimeline component
  // Each SleepPhaseEvent maps directly to SleepStage in SleepTimeline.tsx
  phaseTimeline: SleepPhaseEvent[];
  cycleBreakdown: CycleBreakdown[];
}

export interface PredictedStageDistribution {
  deepPercent: number;
  remPercent: number;
  lightPercent: number;
  awakePercent: number;
  confidence: "high" | "medium" | "low";
  predictionBasis: string[]; // human-readable: e.g. ["age_calibrated", "vo2max_estimated_hrv", "sleep_debt_rebound"]
}

export interface PremiumSleepPrediction {
  stageDistribution: PredictedStageDistribution;
  cycleMap: SleepCycleMap;
  estimatedPhysiology: EstimatedPhysiology; // see Task 3
  predictedSleepScore: number;
  sleepDebtMinutes: number;
  recoveryIndex: number; // 0–100
  insightFlags: string[];
}

export interface EstimatedPhysiology {
  estimatedVO2Max: number;
  estimatedRestingHR: number;
  estimatedHRVrmssd: number;
  estimatedHRMax: number;
  basisNotes: string[]; // e.g. ["age=34", "activity=active", "sex=male"]
}
