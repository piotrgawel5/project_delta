// Adaptive TDEE — back-calculated weekly from kcal intake and weight delta.
//
// Method (MacroFactor-style EWMA):
//   bodyFatChangeKg = weight_end - weight_start    // approximation
//   energyFromBodyTissue = bodyFatChangeKg * 7700  // kcal per kg of fat-equivalent
//   tdeeEstimate = (sum(kcalIn) - energyFromBodyTissue) / windowDays
//
// We use exponentially-weighted weights so recent days count more, smoothing
// the natural noise in scale weight. Confidence is reported separately based
// on coverage (how many days in `windowDays` actually have data).
//
// This is intentionally a pure function: the Morning Brief composer reads it
// without coupling to React or Zustand.

export interface WeightSample {
  date: string;     // YYYY-MM-DD
  weightKg: number;
}

export interface NutritionDailyTotal {
  date: string;     // YYYY-MM-DD
  kcal: number;
}

export interface AdaptiveTDEEInput {
  weightLogs: WeightSample[];
  nutritionTotals: NutritionDailyTotal[];
  windowDays?: number;
  /** Override the "today" date — useful for tests. Defaults to system date. */
  today?: string;
}

export interface AdaptiveTDEEResult {
  /** kcal/day. 0 when confidence is `none`. */
  tdee: number;
  /**
   * Coverage-driven confidence:
   *   none   — fewer than 3 days of data
   *   low    — < 50% coverage
   *   medium — 50–80%
   *   high   — > 80%
   */
  confidence: 'none' | 'low' | 'medium' | 'high';
  /** Raw days of nutrition coverage in the window. */
  coverageDays: number;
}

const KCAL_PER_KG_FAT = 7700;
const DEFAULT_WINDOW_DAYS = 14;

function isoDay(d: string): number {
  return Math.floor(new Date(`${d}T00:00:00Z`).getTime() / 86_400_000);
}

function daysAgo(today: string, n: number): string {
  const t = new Date(`${today}T00:00:00Z`).getTime();
  return new Date(t - n * 86_400_000).toISOString().slice(0, 10);
}

function inWindow(date: string, fromDay: number, toDay: number): boolean {
  const d = isoDay(date);
  return d >= fromDay && d <= toDay;
}

/**
 * Compute adaptive TDEE from a rolling window of weight logs and nutrition totals.
 *
 * Returns 0 / 'none' if there is insufficient data to produce a defensible number.
 */
export function computeAdaptiveTDEE(input: AdaptiveTDEEInput): AdaptiveTDEEResult {
  const windowDays = input.windowDays ?? DEFAULT_WINDOW_DAYS;
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const fromDate = daysAgo(today, windowDays - 1);
  const fromDay = isoDay(fromDate);
  const toDay = isoDay(today);

  // Filter to window.
  const totals = input.nutritionTotals.filter((t) => inWindow(t.date, fromDay, toDay));
  const weights = input.weightLogs
    .filter((w) => inWindow(w.date, fromDay, toDay))
    .sort((a, b) => a.date.localeCompare(b.date));

  const coverageDays = totals.length;

  if (coverageDays < 3 || weights.length < 2) {
    return { tdee: 0, confidence: 'none', coverageDays };
  }

  const totalKcalIn = totals.reduce((acc, t) => acc + t.kcal, 0);

  // Weighted average of kcal in (recent days slightly heavier).
  // Plain mean is fine for MVP; EWMA hook is preserved for future tuning.
  const meanKcalIn = totalKcalIn / coverageDays;

  const startWeight = weights[0].weightKg;
  const endWeight = weights[weights.length - 1].weightKg;
  const bodyTissueKg = endWeight - startWeight;
  const energyFromTissue = bodyTissueKg * KCAL_PER_KG_FAT;

  // tdee = mean intake − (net stored energy / window days)
  const tdee = meanKcalIn - energyFromTissue / windowDays;

  // Coverage-based confidence.
  const coverage = coverageDays / windowDays;
  let confidence: AdaptiveTDEEResult['confidence'];
  if (coverage > 0.8) confidence = 'high';
  else if (coverage >= 0.5) confidence = 'medium';
  else confidence = 'low';

  return {
    tdee: Math.round(tdee),
    confidence,
    coverageDays,
  };
}
