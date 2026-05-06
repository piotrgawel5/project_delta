import type { WorkoutSession } from '@shared';

const WEEKS = 12;
const DAYS_PER_WEEK = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ConsistencyTone = 0 | 1 | 2 | 3 | 4;
export type ConsistencyMatrix = ConsistencyTone[][]; // [12 weeks][7 days]

export interface ConsistencyGrid {
  matrix: ConsistencyMatrix;
  doneDays: number;
  totalDays: number;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function totalSets(s: WorkoutSession): number {
  return s.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
}

function intensityFromSets(sets: number): ConsistencyTone {
  if (sets <= 0) return 0;
  if (sets < 6) return 1;
  if (sets < 12) return 2;
  if (sets < 20) return 3;
  return 4;
}

export function computeConsistencyGrid(sessions: WorkoutSession[]): ConsistencyGrid {
  const today = startOfDay(new Date());
  const totalCells = WEEKS * DAYS_PER_WEEK;
  const startDate = new Date(today.getTime() - (totalCells - 1) * MS_PER_DAY);

  const setsByDay = new Map<string, number>();
  for (const s of sessions) {
    const key = s.date;
    setsByDay.set(key, (setsByDay.get(key) ?? 0) + totalSets(s));
  }

  const matrix: ConsistencyMatrix = [];
  let doneDays = 0;

  for (let w = 0; w < WEEKS; w++) {
    const row: ConsistencyTone[] = [];
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      const cellDate = new Date(startDate.getTime() + (w * DAYS_PER_WEEK + d) * MS_PER_DAY);
      const isFuture = cellDate > today;
      const sets = setsByDay.get(dayKey(cellDate)) ?? 0;
      const tone: ConsistencyTone = isFuture ? 0 : intensityFromSets(sets);
      if (tone > 0) doneDays++;
      row.push(tone);
    }
    matrix.push(row);
  }

  return { matrix, doneDays, totalDays: totalCells };
}
