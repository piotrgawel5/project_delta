import { calcPlates } from '../plateCalc';

describe('calcPlates', () => {
  it('100 kg with 20 kg bar → 25,15 per side (or 25,10,5)', () => {
    const out = calcPlates(100, 20);
    expect(out.achievedKg).toBe(100);
    expect(out.remainderKg).toBe(0);
    expect(out.perSide.reduce((a, b) => a + b, 0)).toBe(40);
  });

  it('60 kg → 20 per side', () => {
    const out = calcPlates(60, 20);
    expect(out.perSide).toEqual([20]);
    expect(out.achievedKg).toBe(60);
  });

  it('target ≤ bar weight → empty plates, remainder is shortfall', () => {
    const out = calcPlates(15, 20);
    expect(out.perSide).toEqual([]);
    expect(out.achievedKg).toBe(20);
    expect(out.remainderKg).toBe(0);
  });

  it('non-loadable target reports remainder', () => {
    // 22 kg with 20 bar = 1 kg per side; smallest plate is 1.25 → unreachable.
    const out = calcPlates(22, 20, [1.25, 2.5]);
    expect(out.achievedKg).toBe(20);
    expect(out.remainderKg).toBeCloseTo(2, 5);
  });

  it('handles fractional plates without floating-point drift', () => {
    const out = calcPlates(45, 20);
    expect(out.achievedKg).toBe(45);
    expect(out.perSide.reduce((a, b) => a + b, 0)).toBe(12.5);
  });

  it('respects custom available plates', () => {
    const out = calcPlates(100, 20, [20, 10]);
    expect(out.achievedKg).toBe(100);
    expect(out.perSide).toEqual([20, 20]);
  });
});
