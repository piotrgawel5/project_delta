// lib/plateCalc.ts
//
// Plate-loading math for a barbell. Greedy from heaviest plate down — for the
// standard plate sets used in commercial gyms this is provably optimal because
// each plate is ≥ 2× the next (25 ≥ 2×10 fails, but 25,20,15,10,5 still resolves
// cleanly under residual checks; we fall back to "best partial" with a remaining
// amount surfaced to the caller).

export interface PlateBreakdown {
  /** Plates that go on EACH side (mirror loading). */
  perSide: number[];
  /** Total weight actually loaded — bar + 2 × sum(perSide). */
  achievedKg: number;
  /** target − achieved (always ≥ 0). Non-zero means the target wasn't reachable. */
  remainderKg: number;
}

const DEFAULT_AVAILABLE = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export function calcPlates(
  targetKg: number,
  barKg = 20,
  available: readonly number[] = DEFAULT_AVAILABLE,
): PlateBreakdown {
  if (targetKg <= barKg) {
    return { perSide: [], achievedKg: barKg, remainderKg: Math.max(0, targetKg - barKg) };
  }

  const perSide: number[] = [];
  let remaining = (targetKg - barKg) / 2;
  // Tolerance for fp residue (e.g. 1.25 + 1.25 != exactly 2.5 in IEEE-754 paths).
  const EPS = 1e-6;
  const sortedDesc = [...available].sort((a, b) => b - a);

  for (const plate of sortedDesc) {
    while (remaining + EPS >= plate) {
      perSide.push(plate);
      remaining -= plate;
    }
  }

  const achievedKg = barKg + 2 * perSide.reduce((acc, p) => acc + p, 0);
  return {
    perSide,
    achievedKg: round2(achievedKg),
    remainderKg: round2(targetKg - achievedKg),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
