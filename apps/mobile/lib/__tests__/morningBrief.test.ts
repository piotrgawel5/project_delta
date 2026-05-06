import { buildMorningBrief, MorningBriefInput } from '../morningBrief';

const baseInput: MorningBriefInput = {
  lastNight: { durationMinutes: 480, deepMinutes: 90 },
  last7DaysDeepMinutes: [80, 85, 90, 95, 88, 92, 87],
  recentSessions: [],
  recentMeals: [],
  profile: { weightKg: 80 },
};

describe('buildMorningBrief', () => {
  it('returns the on-track default when nothing flags', () => {
    const brief = buildMorningBrief(baseInput);
    expect(brief.headline).toMatch(/on track/i);
    expect(brief.recommendations ?? []).toHaveLength(0);
  });

  it('low sleep → deload top set recommendation', () => {
    const brief = buildMorningBrief({
      ...baseInput,
      lastNight: { durationMinutes: 5 * 60, deepMinutes: 60 },
    });
    expect(brief.headline).toMatch(/sleep was short/i);
    expect((brief.recommendations ?? []).join(' ')).toMatch(/deload/i);
  });

  it('heavy legs + low sleep → ~3% lower performance headline', () => {
    const brief = buildMorningBrief({
      ...baseInput,
      lastNight: { durationMinutes: 5.5 * 60, deepMinutes: 60 },
      recentSessions: [
        { date: '2026-05-04', legSetCount: 35, totalSets: 60 },
        { date: '2026-05-02', legSetCount: 20, totalSets: 50 },
      ],
    });
    expect(brief.headline).toMatch(/lower performance/i);
    expect((brief.recommendations ?? []).join(' ')).toMatch(/accessory/i);
  });

  it('low protein + high volume → recovery bottleneck headline', () => {
    const brief = buildMorningBrief({
      ...baseInput,
      // 7-day total = 7 * 60g = 420g; per-day = 60; per kg = 0.75 → low.
      recentMeals: Array.from({ length: 7 }, () => ({
        loggedAt: '2026-05-04T13:00:00.000Z',
        date: '2026-05-04',
        proteinG: 60,
      })),
      // ~ (8 * 1.15) = 9.2 sets/day → high volume.
      recentSessions: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-05-0${i + 1}`,
        legSetCount: 5,
        totalSets: 12,
      })),
    });
    expect(brief.headline).toMatch(/bottleneck/i);
    expect((brief.recommendations ?? []).join(' ')).toMatch(/protein/i);
  });

  it('late meal + low deep → late-meal pattern recommendation', () => {
    const brief = buildMorningBrief({
      ...baseInput,
      lastNight: { durationMinutes: 7 * 60, deepMinutes: 50 }, // below p25 of [80..95]
      recentMeals: [
        {
          // Build a "21:30 local" timestamp using the runtime's offset so the test
          // is timezone-independent.
          loggedAt: new Date(2026, 4, 4, 21, 30).toISOString(),
          date: '2026-05-04',
          proteinG: 30,
        },
      ],
    });
    expect((brief.recommendations ?? []).join(' ')).toMatch(/dinner/i);
  });

  it('produces contributing signals tied to the rule that fired', () => {
    const brief = buildMorningBrief({
      ...baseInput,
      lastNight: { durationMinutes: 5 * 60, deepMinutes: 60 },
    });
    const factors = brief.contributingSignals.map((s) => s.factor);
    expect(factors).toContain('Sleep duration');
  });
});
