import { computeAdaptiveTDEE } from '../nutritionTDEE';

function dailyTotals(startDate: string, days: number, kcal: number) {
  const out: { date: string; kcal: number }[] = [];
  const t = new Date(`${startDate}T00:00:00Z`).getTime();
  for (let i = 0; i < days; i++) {
    out.push({ date: new Date(t + i * 86_400_000).toISOString().slice(0, 10), kcal });
  }
  return out;
}

describe('computeAdaptiveTDEE', () => {
  it('returns confidence=none when fewer than 3 days of data', () => {
    const result = computeAdaptiveTDEE({
      weightLogs: [
        { date: '2026-04-25', weightKg: 80 },
        { date: '2026-05-05', weightKg: 80 },
      ],
      nutritionTotals: dailyTotals('2026-05-01', 2, 2200),
      today: '2026-05-05',
    });
    expect(result.confidence).toBe('none');
    expect(result.tdee).toBe(0);
  });

  it('weight-stable user → tdee equals mean intake', () => {
    const result = computeAdaptiveTDEE({
      weightLogs: [
        { date: '2026-04-22', weightKg: 80 },
        { date: '2026-05-05', weightKg: 80 }, // 14-day window: stable
      ],
      nutritionTotals: dailyTotals('2026-04-22', 14, 2400),
      today: '2026-05-05',
    });
    expect(result.tdee).toBe(2400);
    expect(result.confidence).toBe('high');
    expect(result.coverageDays).toBe(14);
  });

  it('user gaining weight on a surplus → tdee < intake', () => {
    // Gained 1 kg over 14 days → ~7700 kcal stored → 550 kcal/day surplus.
    const result = computeAdaptiveTDEE({
      weightLogs: [
        { date: '2026-04-22', weightKg: 80 },
        { date: '2026-05-05', weightKg: 81 },
      ],
      nutritionTotals: dailyTotals('2026-04-22', 14, 2950),
      today: '2026-05-05',
    });
    // 2950 − 7700/14 ≈ 2400.
    expect(result.tdee).toBeGreaterThanOrEqual(2395);
    expect(result.tdee).toBeLessThanOrEqual(2405);
    expect(result.confidence).toBe('high');
  });

  it('user losing weight on a deficit → tdee > intake', () => {
    const result = computeAdaptiveTDEE({
      weightLogs: [
        { date: '2026-04-22', weightKg: 80 },
        { date: '2026-05-05', weightKg: 79 }, // -1 kg over window
      ],
      nutritionTotals: dailyTotals('2026-04-22', 14, 1900),
      today: '2026-05-05',
    });
    // 1900 + 7700/14 ≈ 2450.
    expect(result.tdee).toBeGreaterThanOrEqual(2445);
    expect(result.tdee).toBeLessThanOrEqual(2455);
  });

  it('partial coverage → medium confidence', () => {
    const result = computeAdaptiveTDEE({
      weightLogs: [
        { date: '2026-04-26', weightKg: 80 },
        { date: '2026-05-05', weightKg: 80 },
      ],
      nutritionTotals: dailyTotals('2026-04-26', 8, 2200),
      today: '2026-05-05',
    });
    expect(result.coverageDays).toBe(8);
    expect(result.confidence).toBe('medium');
    expect(result.tdee).toBe(2200);
  });

  it('ignores data outside the window', () => {
    const result = computeAdaptiveTDEE({
      weightLogs: [
        { date: '2025-01-01', weightKg: 90 }, // outside window
        { date: '2026-04-22', weightKg: 80 },
        { date: '2026-05-05', weightKg: 80 },
      ],
      nutritionTotals: [
        ...dailyTotals('2025-01-01', 5, 9999), // outside window — must be ignored
        ...dailyTotals('2026-04-22', 14, 2300),
      ],
      today: '2026-05-05',
    });
    expect(result.tdee).toBe(2300);
    expect(result.coverageDays).toBe(14);
  });
});
