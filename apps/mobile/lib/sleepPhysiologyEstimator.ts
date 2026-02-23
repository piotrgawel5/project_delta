import type { EstimatedPhysiology } from '@shared';

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
type Sex = 'male' | 'female';

const VO2MAX_BASE: Record<ActivityLevel, { male: number; female: number }> = {
  sedentary: { male: 35, female: 30 },
  light: { male: 40, female: 35 },
  moderate: { male: 46, female: 41 },
  active: { male: 53, female: 47 },
  very_active: { male: 59, female: 53 },
};

const RESTING_HR_ANCHOR_BASE_MALE: Record<ActivityLevel, number> = {
  sedentary: 52,
  light: 50,
  moderate: 48,
  active: 46,
  very_active: 42,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseAge(date_of_birth?: string | null): { age: number; assumed: boolean } {
  if (!date_of_birth) return { age: 35, assumed: true };

  const dob = new Date(date_of_birth);
  if (Number.isNaN(dob.getTime())) return { age: 35, assumed: true };

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }

  if (!Number.isFinite(age) || age <= 0 || age > 120) {
    return { age: 35, assumed: true };
  }

  return { age, assumed: false };
}

function normalizeSex(sex?: string | null): { value: Sex | null; assumed: boolean } {
  if (sex === 'male' || sex === 'female') return { value: sex, assumed: false };
  return { value: null, assumed: true };
}

function normalizeActivityLevel(
  activity_level?: string | null
): { value: ActivityLevel; assumed: boolean } {
  if (
    activity_level === 'sedentary' ||
    activity_level === 'light' ||
    activity_level === 'moderate' ||
    activity_level === 'active' ||
    activity_level === 'very_active'
  ) {
    return { value: activity_level, assumed: false };
  }

  return { value: 'moderate', assumed: true };
}

export function estimatePhysiology(profile: {
  date_of_birth?: string | null;
  sex?: string | null;
  activity_level?: string | null;
}): EstimatedPhysiology & {
  estimatedRespiratoryRate: number;
} {
  const basisNotes: string[] = [];

  const { age, assumed: assumedAge } = parseAge(profile?.date_of_birth);
  const { value: sex, assumed: assumedSex } = normalizeSex(profile?.sex);
  const { value: activity, assumed: assumedActivity } = normalizeActivityLevel(
    profile?.activity_level
  );

  basisNotes.push(`age=${age}`);
  basisNotes.push(`activity=${activity}`);
  basisNotes.push(`sex=${sex ?? 'average'}`);
  if (assumedAge) basisNotes.push('assumed_age=35');
  if (assumedActivity) basisNotes.push('assumed_activity=moderate');
  if (assumedSex) basisNotes.push('assumed_sex=average');

  const activityBase = VO2MAX_BASE[activity];
  const baseVO2Max =
    sex === null ? (activityBase.male + activityBase.female) / 2 : activityBase[sex];

  // Keep age correction mild to align with broad adult normative ranges.
  const ageFactor = 1 - Math.max(0, age - 25) * 0.0025;
  const adjustedVO2Max = baseVO2Max * ageFactor;
  const estimatedVO2Max = Number(clamp(adjustedVO2Max, 10, 80).toFixed(1));

  const estimatedHRMax = Number((207 - 0.7 * age).toFixed(1));
  const rawRestingHR = estimatedHRMax / (estimatedVO2Max / 15);
  const restingAnchor =
    RESTING_HR_ANCHOR_BASE_MALE[activity] +
    (sex === 'female' ? 4 : 0) +
    Math.max(0, age - 30) * 0.35;
  const calibratedRestingHR = rawRestingHR * 0.12 + restingAnchor * 0.88;
  const estimatedRestingHR = Number(clamp(calibratedRestingHR, 38, 90).toFixed(1));

  let estimatedHRVrmssd = 20 + (70 - estimatedRestingHR) * 0.9;
  estimatedHRVrmssd = clamp(estimatedHRVrmssd, 12, 80);
  if (sex === 'female') {
    estimatedHRVrmssd += 6;
  }
  estimatedHRVrmssd -= Math.max(0, age - 30) * 0.15;
  estimatedHRVrmssd = Number(clamp(estimatedHRVrmssd, 12, 80).toFixed(1));

  const rawRespiratoryRate = 14 - (estimatedVO2Max - 35) * 0.05;
  const estimatedRespiratoryRate = Number(clamp(rawRespiratoryRate, 12, 17).toFixed(1));

  return {
    estimatedVO2Max,
    estimatedRestingHR,
    estimatedHRVrmssd,
    estimatedHRMax,
    basisNotes,
    estimatedRespiratoryRate,
  };
}
