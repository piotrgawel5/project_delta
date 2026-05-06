import { suggestNextSession } from '../workoutProgression';
import type { WorkoutSession, WorkoutSet } from '@shared';

function set(overrides: Partial<WorkoutSet> = {}, n = 1): WorkoutSet {
  return {
    id: `s${n}`,
    setNumber: n,
    reps: 8,
    weightKg: 80,
    durationSeconds: null,
    completedAt: '2026-05-04T10:00:00Z',
    rpe: 7,
    ...overrides,
  };
}

function session(date: string, sets: WorkoutSet[]): WorkoutSession {
  return {
    id: `sess-${date}`,
    userId: 'u',
    date,
    startedAt: `${date}T10:00:00Z`,
    finishedAt: `${date}T11:00:00Z`,
    durationSeconds: 3600,
    exercises: [{ exerciseId: 'bench', sets, notes: null }],
    notes: null,
    name: null,
    feelRating: null,
    difficultyRating: null,
  };
}

describe('suggestNextSession', () => {
  it('adds 2.5 kg to top set when all reps hit at RPE ≤ 8', () => {
    const out = suggestNextSession(
      [session('2026-05-04', [set({ weightKg: 60 }, 1), set({ weightKg: 80 }, 2)])],
      'bench',
    );
    expect(out).not.toBeNull();
    expect(out!.isOverload).toBe(true);
    expect(out!.sets[0].weightKg).toBe(60);
    expect(out!.sets[1].weightKg).toBe(82.5);
    expect(out!.rationale).toMatch(/\+2\.5 kg/);
  });

  it('repeats when last attempt missed reps (RPE 9)', () => {
    const out = suggestNextSession(
      [session('2026-05-04', [set({ weightKg: 80, rpe: 9 })])],
      'bench',
    );
    expect(out!.isOverload).toBe(false);
    expect(out!.sets[0].weightKg).toBe(80);
    expect(out!.rationale).toMatch(/repeat/i);
  });

  it('caps at +5 kg/week — holds when week-over-week delta would exceed cap', () => {
    const out = suggestNextSession(
      [
        session('2026-05-04', [set({ weightKg: 85 })]),
        session('2026-04-26', [set({ weightKg: 80 })]),
      ],
      'bench',
    );
    expect(out!.isOverload).toBe(false);
    expect(out!.sets[0].weightKg).toBe(85);
    expect(out!.rationale).toMatch(/already \+5/);
  });

  it('repeats bodyweight sets without trying to add load', () => {
    const out = suggestNextSession(
      [session('2026-05-04', [set({ weightKg: null, reps: 12 })])],
      'pull_up',
    );
    expect(out).toBeNull();

    const bw = suggestNextSession(
      [
        {
          ...session('2026-05-04', []),
          exercises: [
            { exerciseId: 'pull_up', sets: [set({ weightKg: null, reps: 12 })], notes: null },
          ],
        },
      ],
      'pull_up',
    );
    expect(bw!.isOverload).toBe(false);
    expect(bw!.sets[0].weightKg).toBeNull();
  });

  it('returns null when no prior session exists', () => {
    expect(suggestNextSession([], 'bench')).toBeNull();
  });
});
