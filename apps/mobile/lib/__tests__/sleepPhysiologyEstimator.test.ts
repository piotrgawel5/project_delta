/// <reference types="jest" />

import { estimatePhysiology } from '../sleepPhysiologyEstimator';

function dobForAge(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

describe('estimatePhysiology', () => {
  test('Active 30yo male -> VO2max ~53, HRrest ~44-50, rMSSD ~35-45', () => {
    const result = estimatePhysiology({
      date_of_birth: dobForAge(30),
      sex: 'male',
      activity_level: 'active',
    });

    expect(result.estimatedVO2Max).toBeGreaterThanOrEqual(51);
    expect(result.estimatedVO2Max).toBeLessThanOrEqual(55);
    expect(result.estimatedRestingHR).toBeGreaterThanOrEqual(44);
    expect(result.estimatedRestingHR).toBeLessThanOrEqual(50);
    expect(result.estimatedHRVrmssd).toBeGreaterThanOrEqual(35);
    expect(result.estimatedHRVrmssd).toBeLessThanOrEqual(45);
  });

  test('Sedentary 60yo female -> VO2max ~27-30, HRrest ~65-75, rMSSD ~20-28', () => {
    const result = estimatePhysiology({
      date_of_birth: dobForAge(60),
      sex: 'female',
      activity_level: 'sedentary',
    });

    expect(result.estimatedVO2Max).toBeGreaterThanOrEqual(27);
    expect(result.estimatedVO2Max).toBeLessThanOrEqual(30);
    expect(result.estimatedRestingHR).toBeGreaterThanOrEqual(65);
    expect(result.estimatedRestingHR).toBeLessThanOrEqual(75);
    expect(result.estimatedHRVrmssd).toBeGreaterThanOrEqual(20);
    expect(result.estimatedHRVrmssd).toBeLessThanOrEqual(28);
  });

  test('Null inputs -> returns defaults without throwing', () => {
    expect(() => estimatePhysiology({})).not.toThrow();
    const result = estimatePhysiology({});

    expect(Number.isFinite(result.estimatedVO2Max)).toBe(true);
    expect(Number.isFinite(result.estimatedRestingHR)).toBe(true);
    expect(Number.isFinite(result.estimatedHRVrmssd)).toBe(true);
    expect(Number.isFinite(result.estimatedHRMax)).toBe(true);
  });

  test('Age 25 exact -> no age correction applied to VO2max', () => {
    const result = estimatePhysiology({
      date_of_birth: dobForAge(25),
      sex: 'male',
      activity_level: 'active',
    });
    expect(result.estimatedVO2Max).toBeCloseTo(53, 1);
  });

  test('basisNotes always populated', () => {
    const withProfile = estimatePhysiology({
      date_of_birth: dobForAge(34),
      sex: 'male',
      activity_level: 'active',
    });
    const defaults = estimatePhysiology({});

    expect(withProfile.basisNotes.length).toBeGreaterThan(0);
    expect(defaults.basisNotes.length).toBeGreaterThan(0);
  });
});
