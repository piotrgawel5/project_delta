import type { EstimatedPhysiology } from '@shared';

// Base VO2max by activity level (mL/kg/min) — from ACSM normative tables
const VO2MAX_BASE: Record<string, { male: number; female: number }> = {
  sedentary:   { male: 35, female: 30 },
  light:       { male: 40, female: 35 },
  moderate:    { male: 46, female: 41 },
  active:      { male: 53, female: 47 },
  very_active: { male: 59, female: 53 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeAge(dateOfBirth?: string | null): number {
  if (!dateOfBirth) return 35;
  const birth = new Date(dateOfBirth);
  const now = new Date();
  const age = now.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  return hasBirthdayPassed ? age : age - 1;
}

export function estimatePhysiology(profile: {
  date_of_birth?: string | null;
  sex?: string | null;
  activity_level?: string | null;
}): EstimatedPhysiology & { estimatedRespiratoryRate: number } {
  const basisNotes: string[] = [];

  // Age
  const age = computeAge(profile.date_of_birth);
  basisNotes.push(`age=${age}`);

  // Activity level
  const activityLevel = profile.activity_level ?? 'moderate';
  basisNotes.push(`activity=${activityLevel}`);

  // Sex
  const sex = profile.sex === 'male' || profile.sex === 'female' ? profile.sex : null;
  basisNotes.push(`sex=${sex ?? 'unknown'}`);

  // VO2max base
  const base = VO2MAX_BASE[activityLevel] ?? VO2MAX_BASE['moderate'];
  let vo2max: number;
  if (sex === 'male') {
    vo2max = base.male;
  } else if (sex === 'female') {
    vo2max = base.female;
  } else {
    vo2max = (base.male + base.female) / 2;
  }

  // Age correction: ~1% decline per year after 25
  const ageCorrection = Math.max(0, age - 25) * 0.01;
  vo2max = vo2max * (1 - ageCorrection);

  // HRmax — Tanaka formula
  const hrMax = Math.round(207 - 0.7 * age);

  // HRrest — Uth-Sørensen formula
  let hrRest = hrMax / (vo2max / 15);
  hrRest = clamp(hrRest, 38, 90);

  // HRV rMSSD estimate
  let hrv = 20 + (70 - hrRest) * 0.9;
  hrv = clamp(hrv, 12, 80);
  if (sex === 'female') hrv += 5;
  hrv -= Math.max(0, age - 30) * 0.25;
  hrv = clamp(hrv, 12, 80);

  // Respiratory rate
  const baseRR = 14 - (vo2max - 35) * 0.05;
  const respiratoryRate = clamp(baseRR, 12, 17);

  return {
    estimatedVO2Max:          Math.round(vo2max * 10) / 10,
    estimatedRestingHR:       Math.round(hrRest),
    estimatedHRVrmssd:        Math.round(hrv * 10) / 10,
    estimatedHRMax:           hrMax,
    estimatedRespiratoryRate: Math.round(respiratoryRate * 10) / 10,
    basisNotes,
  };
}
