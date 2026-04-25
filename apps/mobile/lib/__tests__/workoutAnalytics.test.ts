import type { WorkoutSession } from '@shared';
import {
  computeDailyVolumeSeries,
  computeMuscleHeatmap,
  computeWeeklyVolume,
  getNeglectedMuscles,
  getSessionMuscles,
  getTotalSets,
  isOvertrained,
} from '../workoutAnalytics';

// Fixed reference: a Wednesday so Mon–Sun week spans Mon 2026-04-20 → Sun 2026-04-26
const REF = new Date('2026-04-22T12:00:00.000Z');

function makeSession(
  id: string,
  date: string,
  exerciseIds: string[],
  setsPerExercise = 3,
): WorkoutSession {
  return {
    id,
    userId: 'user-1',
    date,
    startedAt: `${date}T10:00:00.000Z`,
    finishedAt: `${date}T11:00:00.000Z`,
    durationSeconds: 3600,
    exercises: exerciseIds.map((exerciseId, ei) => ({
      exerciseId,
      sets: Array.from({ length: setsPerExercise }, (_, i) => ({
        id: `${id}-${ei}-set-${i}`,
        setNumber: i + 1,
        reps: 8,
        weightKg: 80,
        durationSeconds: null,
        completedAt: `${date}T10:${String(i).padStart(2, '0')}:00.000Z`,
        rpe: null,
      })),
      notes: null,
    })),
    notes: null,
    name: null,
    feelRating: null,
    difficultyRating: null,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(REF);
});

afterEach(() => {
  jest.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// getTotalSets
// ─────────────────────────────────────────────────────────────────────────────

describe('getTotalSets', () => {
  it('returns 0 for a session with no exercises', () => {
    expect(getTotalSets(makeSession('s1', '2026-04-22', []))).toBe(0);
  });

  it('returns sets for a single exercise', () => {
    expect(getTotalSets(makeSession('s1', '2026-04-22', ['barbell_bench_press'], 4))).toBe(4);
  });

  it('sums sets across multiple exercises', () => {
    const session = makeSession('s1', '2026-04-22', ['barbell_bench_press', 'barbell_squat'], 3);
    expect(getTotalSets(session)).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getSessionMuscles
// ─────────────────────────────────────────────────────────────────────────────

describe('getSessionMuscles', () => {
  it('returns empty array for no exercises', () => {
    expect(getSessionMuscles(makeSession('s1', '2026-04-22', []))).toHaveLength(0);
  });

  it('includes primary and secondary muscles', () => {
    // barbell_bench_press: primary=[chest], secondary=[front_delts, triceps]
    const muscles = getSessionMuscles(makeSession('s1', '2026-04-22', ['barbell_bench_press']));
    expect(muscles).toContain('chest');
    expect(muscles).toContain('front_delts');
    expect(muscles).toContain('triceps');
  });

  it('deduplicates muscles across exercises with shared targets', () => {
    // Both bench variations hit chest + front_delts + triceps
    const muscles = getSessionMuscles(
      makeSession('s1', '2026-04-22', ['barbell_bench_press', 'dumbbell_bench_press']),
    );
    expect(muscles.filter((m) => m === 'chest')).toHaveLength(1);
  });

  it('skips unknown exercise IDs gracefully', () => {
    const muscles = getSessionMuscles(makeSession('s1', '2026-04-22', ['nonexistent_exercise']));
    expect(muscles).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeMuscleHeatmap
// ─────────────────────────────────────────────────────────────────────────────

describe('computeMuscleHeatmap', () => {
  it('returns all 18 muscles as keys', () => {
    const heatmap = computeMuscleHeatmap([], 7);
    expect(Object.keys(heatmap)).toHaveLength(18);
  });

  it('returns intensity 0 for all muscles with no sessions', () => {
    const heatmap = computeMuscleHeatmap([], 7);
    expect(Object.values(heatmap).every((v) => v === 0)).toBe(true);
  });

  it('returns intensity 0 for sessions outside lookback window', () => {
    const old = makeSession('s1', '2026-04-01', ['barbell_bench_press']);
    const heatmap = computeMuscleHeatmap([old], 7);
    expect(heatmap['chest']).toBe(0);
  });

  it('buckets chest at intensity 1 after 1 session (score 1.0 < 2)', () => {
    const session = makeSession('s1', '2026-04-22', ['barbell_bench_press']);
    const heatmap = computeMuscleHeatmap([session], 7);
    expect(heatmap['chest']).toBe(1);
  });

  it('buckets chest at intensity 2 after 2 sessions (score 2.0, 2 ≤ s < 5)', () => {
    const sessions = [
      makeSession('s1', '2026-04-21', ['barbell_bench_press']),
      makeSession('s2', '2026-04-22', ['barbell_bench_press']),
    ];
    const heatmap = computeMuscleHeatmap(sessions, 7);
    expect(heatmap['chest']).toBe(2);
  });

  it('buckets chest at intensity 3 when score ≥ 5', () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession(`s${i}`, '2026-04-22', ['barbell_bench_press']),
    );
    const heatmap = computeMuscleHeatmap(sessions, 7);
    expect(heatmap['chest']).toBe(3);
  });

  it('secondary muscle contribution (0.5) is counted', () => {
    // front_delts is secondary on bench press; need 4 sessions to push score to ≥2
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession(`s${i}`, '2026-04-22', ['barbell_bench_press']),
    );
    const heatmap = computeMuscleHeatmap(sessions, 7);
    // 4 × 0.5 = 2.0 → intensity 2
    expect(heatmap['front_delts']).toBe(2);
  });

  it('untrained muscles remain at 0 regardless of other activity', () => {
    const session = makeSession('s1', '2026-04-22', ['barbell_bench_press']);
    const heatmap = computeMuscleHeatmap([session], 7);
    expect(heatmap['quads']).toBe(0);
    expect(heatmap['hamstrings']).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isOvertrained
// ─────────────────────────────────────────────────────────────────────────────

describe('isOvertrained', () => {
  it('returns false with no sessions', () => {
    expect(isOvertrained('chest', [])).toBe(false);
  });

  it('returns false when muscle trained ≤3 times in 7 days', () => {
    const sessions = Array.from({ length: 3 }, (_, i) =>
      makeSession(`s${i}`, '2026-04-22', ['barbell_bench_press']),
    );
    expect(isOvertrained('chest', sessions)).toBe(false);
  });

  it('returns true when muscle trained >3 times in 7 days', () => {
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession(`s${i}`, '2026-04-22', ['barbell_bench_press']),
    );
    expect(isOvertrained('chest', sessions)).toBe(true);
  });

  it('ignores sessions outside 7-day window', () => {
    const oldSessions = Array.from({ length: 4 }, (_, i) =>
      makeSession(`s${i}`, '2026-04-01', ['barbell_bench_press']),
    );
    expect(isOvertrained('chest', oldSessions)).toBe(false);
  });

  it('only counts sessions where muscle is PRIMARY (not secondary)', () => {
    // front_delts is SECONDARY on bench; 4 sessions should not flag it as overtrained
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession(`s${i}`, '2026-04-22', ['barbell_bench_press']),
    );
    expect(isOvertrained('front_delts', sessions)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeWeeklyVolume
// ─────────────────────────────────────────────────────────────────────────────

describe('computeWeeklyVolume', () => {
  it('returns 0 with no sessions', () => {
    expect(computeWeeklyVolume([])).toBe(0);
  });

  it('sums sets for sessions within the past 7 days', () => {
    const sessions = [
      makeSession('s1', '2026-04-22', ['barbell_bench_press'], 3), // 3 sets
      makeSession('s2', '2026-04-21', ['barbell_squat'], 4),       // 4 sets
    ];
    expect(computeWeeklyVolume(sessions)).toBe(7);
  });

  it('excludes sessions older than 7 days', () => {
    const sessions = [
      makeSession('s1', '2026-04-22', ['barbell_bench_press'], 3),
      makeSession('s2', '2026-04-01', ['barbell_bench_press'], 5), // too old
    ];
    expect(computeWeeklyVolume(sessions)).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeDailyVolumeSeries
// ─────────────────────────────────────────────────────────────────────────────

describe('computeDailyVolumeSeries', () => {
  // REF = Wednesday 2026-04-22 → Mon=2026-04-20 (index 0), Wed=2026-04-22 (index 2)

  it('returns 7 zeros with no sessions', () => {
    expect(computeDailyVolumeSeries([])).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it('places sets on the correct weekday index (Wednesday = index 2)', () => {
    const series = computeDailyVolumeSeries([
      makeSession('s1', '2026-04-22', ['barbell_bench_press'], 3),
    ]);
    expect(series[2]).toBe(3);
    expect(series.filter((v) => v > 0)).toHaveLength(1);
  });

  it('places sets on Monday (index 0)', () => {
    const series = computeDailyVolumeSeries([
      makeSession('s1', '2026-04-20', ['barbell_bench_press'], 2),
    ]);
    expect(series[0]).toBe(2);
  });

  it('accumulates multiple sessions on the same day', () => {
    const series = computeDailyVolumeSeries([
      makeSession('s1', '2026-04-22', ['barbell_bench_press'], 3),
      makeSession('s2', '2026-04-22', ['barbell_squat'], 4),
    ]);
    expect(series[2]).toBe(7);
  });

  it('ignores sessions outside the current Mon–Sun week', () => {
    const series = computeDailyVolumeSeries([
      makeSession('s1', '2026-04-15', ['barbell_bench_press'], 5), // previous week
    ]);
    expect(series.every((v) => v === 0)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getNeglectedMuscles
// ─────────────────────────────────────────────────────────────────────────────

describe('getNeglectedMuscles', () => {
  it('returns all 18 muscles when there are no sessions', () => {
    expect(getNeglectedMuscles([], 7)).toHaveLength(18);
  });

  it('excludes muscles trained as primary within the threshold', () => {
    const sessions = [makeSession('s1', '2026-04-22', ['barbell_bench_press'])];
    const neglected = getNeglectedMuscles(sessions, 7);
    expect(neglected).not.toContain('chest');
  });

  it('includes muscles only trained as secondary (not primary)', () => {
    // front_delts is secondary on bench press — should still appear as neglected
    const sessions = [makeSession('s1', '2026-04-22', ['barbell_bench_press'])];
    const neglected = getNeglectedMuscles(sessions, 7);
    expect(neglected).toContain('front_delts');
  });

  it('includes muscles trained outside the threshold window', () => {
    const sessions = [makeSession('s1', '2026-04-01', ['barbell_bench_press'])];
    const neglected = getNeglectedMuscles(sessions, 7);
    expect(neglected).toContain('chest');
  });

  it('respects a custom threshold (14 days)', () => {
    // Session 10 days ago — within 14d threshold, outside 7d
    const sessions = [makeSession('s1', '2026-04-12', ['barbell_bench_press'])];
    expect(getNeglectedMuscles(sessions, 7)).toContain('chest');
    expect(getNeglectedMuscles(sessions, 14)).not.toContain('chest');
  });
});
