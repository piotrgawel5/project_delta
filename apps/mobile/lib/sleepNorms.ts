import type { AgeNorm } from '@shared';
import { AGE_NORMS } from '@constants';

type AgeNormBucket = keyof typeof AGE_NORMS;

const DEFAULT_AGE_BUCKET: AgeNormBucket = '26-35';

export function getAgeNorm(age?: number): AgeNorm {
  if (age === undefined || age === null) return AGE_NORMS[DEFAULT_AGE_BUCKET];
  if (age < 18) return AGE_NORMS.under18;
  if (age <= 25) return AGE_NORMS['18-25'];
  if (age <= 35) return AGE_NORMS['26-35'];
  if (age <= 50) return AGE_NORMS['36-50'];
  if (age <= 65) return AGE_NORMS['51-65'];
  return AGE_NORMS['65plus'];
}
