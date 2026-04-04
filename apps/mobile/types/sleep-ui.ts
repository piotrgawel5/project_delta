import type { MutableRefObject } from 'react';
import type { SharedValue } from 'react-native-reanimated';

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
  /** Real-time horizontal scroll offset of the day pager (updated on JS thread). */
  pagerScrollX: SharedValue<number>;
  /** Index of the currently settled page — updated only after snap. */
  pageIndex: number;
  /** Grade string ('--' = no data) for the previous day, used for live blend. */
  prevGrade: string;
  /** Grade string ('--' = no data) for the next day, used for live blend. */
  nextGrade: string;
  /** Set to true by the pager before a drag-triggered date change; consumed by SleepHero to skip gradient animation. */
  instantTransitionRef: MutableRefObject<boolean>;
  /** Swipe direction for hero text slide animation. null = calendar/initial (cross-fade). */
  swipeDirection: 'left' | 'right' | null;
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
