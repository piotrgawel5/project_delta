import type { MuscleGroup } from '@shared';
import { MUSCLE_PATHS, BODY_OUTLINE_FRONT, BODY_OUTLINE_BACK } from '@components/workout/muscleMap/musclePaths';

const ALL_MUSCLES: MuscleGroup[] = [
  'chest', 'front_delts', 'side_delts', 'rear_delts',
  'biceps', 'triceps', 'forearms',
  'upper_back', 'lats', 'lower_back', 'traps',
  'abs', 'obliques',
  'quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors',
];

const PATH_D_REGEX = /^M\s/;

describe('MUSCLE_PATHS', () => {
  it('has an entry for every MuscleGroup', () => {
    for (const muscle of ALL_MUSCLES) {
      expect(MUSCLE_PATHS).toHaveProperty(muscle);
    }
  });

  it('has no extra keys beyond the 18 defined MuscleGroups', () => {
    const keys = Object.keys(MUSCLE_PATHS);
    expect(keys).toHaveLength(ALL_MUSCLES.length);
  });

  it('every muscle has at least one path', () => {
    for (const muscle of ALL_MUSCLES) {
      expect(MUSCLE_PATHS[muscle].length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every path d string starts with "M "', () => {
    for (const muscle of ALL_MUSCLES) {
      for (const path of MUSCLE_PATHS[muscle]) {
        expect(path.d).toMatch(PATH_D_REGEX);
      }
    }
  });

  it('every path has a valid side value', () => {
    for (const muscle of ALL_MUSCLES) {
      for (const path of MUSCLE_PATHS[muscle]) {
        expect(['front', 'back']).toContain(path.side);
      }
    }
  });

  it('silhouette outlines are non-empty strings starting with "M "', () => {
    expect(BODY_OUTLINE_FRONT).toMatch(PATH_D_REGEX);
    expect(BODY_OUTLINE_BACK).toMatch(PATH_D_REGEX);
  });
});
