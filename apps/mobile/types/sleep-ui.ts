export interface SleepHeroProps {
  selectedDate: Date;
  score: number | undefined;
  grade: string;
  gradeColor: string;
  durationMinutes: number | null;
  description: string;
  weeklyDelta: number | null;
  isLoading: boolean;
  chartData: (number | null)[];
  todayIndex: number;
  targetMinutes?: number;
  onPressDate?: () => void;
}

export interface HeroGradientStops {
  primary: string;
  mid: string;
  end: string;
}

export interface WeeklySleepChartProps {
  data: (number | null)[];
  todayIndex: number;
  targetMinutes?: number;
}

export interface ChartPoint {
  x: number;
  y: number;
  hasData: boolean;
}

export interface TimeParts {
  time: string;
  meridiem: string;
}

export interface SleepCardBedtimeProps {
  bedtime: TimeParts | null;
  wakeTime: TimeParts | null;
  weekBedtimes: (number | null)[];
  weekWakeTimes: (number | null)[];
  todayIndex: number;
}

export interface SleepCardDeepProps {
  deepMinutes: number | null;
  totalMinutes: number | null;
}

export type DeepSleepZone = 'great' | 'fair' | 'low' | 'nodata';

export interface SleepEmptyStateProps {
  date: Date;
  onAddData: () => void;
}

export interface SleepEditLinkProps {
  onPress: () => void;
}

export interface SleepSkeletonProps {
  visible?: boolean;
}

export interface WeekSeriesData {
  durations: (number | null)[];
  bedtimes: (number | null)[];
  wakeTimes: (number | null)[];
  scores: (number | null)[];
  todayIndex: number;
}
