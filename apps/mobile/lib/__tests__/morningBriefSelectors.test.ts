import {
  selectLast7DaysDeep,
  selectMorningBriefProfile,
  selectRecentMeals,
  selectSleepNight,
} from '../morningBriefSelectors';

describe('morningBriefSelectors', () => {
  describe('selectSleepNight', () => {
    it('returns the latest record on/before today', () => {
      const out = selectSleepNight(
        [
          { date: '2026-05-04', duration_minutes: 420, deep_sleep_minutes: 70 },
          { date: '2026-05-03', duration_minutes: 480, deep_sleep_minutes: 90 },
        ],
        '2026-05-05',
      );
      expect(out).toEqual({ durationMinutes: 420, deepMinutes: 70 });
    });

    it('returns null when no record has duration', () => {
      const out = selectSleepNight(
        [{ date: '2026-05-04', duration_minutes: null }],
        '2026-05-05',
      );
      expect(out).toBeNull();
    });
  });

  describe('selectLast7DaysDeep', () => {
    it('excludes today and zero/null deep minutes', () => {
      const out = selectLast7DaysDeep(
        [
          { date: '2026-05-05', deep_sleep_minutes: 80 },
          { date: '2026-05-04', deep_sleep_minutes: 90 },
          { date: '2026-05-03', deep_sleep_minutes: 0 },
          { date: '2026-05-02', deep_sleep_minutes: 70 },
        ],
        '2026-05-05',
      );
      expect(out).toEqual([90, 70]);
    });
  });

  describe('selectRecentMeals', () => {
    it('returns meals within the last 7 days', () => {
      const out = selectRecentMeals(
        {
          '2026-04-25': [
            { loggedAt: '2026-04-25T12:00:00Z', date: '2026-04-25', proteinG: 30 } as never,
          ],
          '2026-05-04': [
            { loggedAt: '2026-05-04T12:00:00Z', date: '2026-05-04', proteinG: 40 } as never,
          ],
        },
        '2026-05-05',
      );
      expect(out).toHaveLength(1);
      expect(out[0].proteinG).toBe(40);
    });
  });

  describe('selectMorningBriefProfile', () => {
    it('converts lbs to kg', () => {
      const out = selectMorningBriefProfile({ weight_value: 176.37, weight_unit: 'lbs' });
      expect(out.weightKg).toBeCloseTo(80, 1);
    });

    it('passes kg through', () => {
      const out = selectMorningBriefProfile({ weight_value: 80, weight_unit: 'kg' });
      expect(out.weightKg).toBe(80);
    });

    it('returns null when missing', () => {
      expect(selectMorningBriefProfile(null)).toEqual({ weightKg: null });
    });
  });
});
