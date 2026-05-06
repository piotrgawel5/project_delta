import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { MuscleGroup, MuscleIntensity } from '@shared';
import { SLEEP_THEME } from '@constants';
import AnimatedMusclePath from './AnimatedMusclePath';
import {
  BODY_OUTLINE_BACK,
  BODY_OUTLINE_FRONT,
  HEAD_BACK,
  HEAD_FRONT,
  MUSCLE_PATHS,
} from './musclePaths';

// ─────────────────────────────────────────────────────────────────────────────
// ViewBox: 200×180 — front [0..100], back [100..200]
// ─────────────────────────────────────────────────────────────────────────────

const VIEW_BOXES = {
  front: '0 0 100 180',
  back: '100 0 100 180',
  both: '0 0 200 180',
} as const;

// Aspect ratios: front/back = 100:180, both = 200:180
const ASPECT_RATIOS = {
  front: 100 / 180,
  back: 100 / 180,
  both: 200 / 180,
} as const;

export interface MuscleHeatmapSVGProps {
  heatmap: Record<MuscleGroup, MuscleIntensity>;
  overtrainedMuscles?: readonly MuscleGroup[];
  view: 'front' | 'back' | 'both';
  width: number;
  onMusclePress?: (muscle: MuscleGroup) => void;
}

const ALL_MUSCLES = Object.keys(MUSCLE_PATHS) as MuscleGroup[];

function MuscleHeatmapSVGComponent({
  heatmap,
  overtrainedMuscles = [],
  view,
  width,
  onMusclePress,
}: MuscleHeatmapSVGProps) {
  const height = Math.round(width / ASPECT_RATIOS[view]);
  const viewBox = VIEW_BOXES[view];
  const overtrainSet = new Set<MuscleGroup>(overtrainedMuscles);

  const showFront = view === 'front' || view === 'both';
  const showBack = view === 'back' || view === 'both';

  return (
    <Svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
      {/* ── Front half ────────────────────────────────────────────────────── */}
      {showFront && (
        <>
          {/* Body silhouette */}
          <Circle
            cx={HEAD_FRONT.cx}
            cy={HEAD_FRONT.cy}
            r={HEAD_FRONT.r}
            fill={SLEEP_THEME.cardBg}
            stroke={SLEEP_THEME.border}
            strokeWidth={0.8}
            strokeOpacity={0.3}
          />
          <Path
            d={BODY_OUTLINE_FRONT}
            fill={SLEEP_THEME.cardBg}
            stroke={SLEEP_THEME.border}
            strokeWidth={0.8}
            strokeOpacity={0.3}
          />

          {/* Muscle paths */}
          {ALL_MUSCLES.map((muscle) =>
            MUSCLE_PATHS[muscle]
              .filter((p) => p.side === 'front')
              .map((p, idx) => (
                <AnimatedMusclePath
                  key={`front-${muscle}-${idx}`}
                  d={p.d}
                  intensity={heatmap[muscle]}
                  isOvertrained={overtrainSet.has(muscle)}
                  onPress={onMusclePress ? () => onMusclePress(muscle) : undefined}
                />
              ))
          )}
        </>
      )}

      {/* ── Back half ─────────────────────────────────────────────────────── */}
      {showBack && (
        <>
          <Circle
            cx={HEAD_BACK.cx}
            cy={HEAD_BACK.cy}
            r={HEAD_BACK.r}
            fill={SLEEP_THEME.cardBg}
            stroke={SLEEP_THEME.border}
            strokeWidth={0.8}
            strokeOpacity={0.3}
          />
          <Path
            d={BODY_OUTLINE_BACK}
            fill={SLEEP_THEME.cardBg}
            stroke={SLEEP_THEME.border}
            strokeWidth={0.8}
            strokeOpacity={0.3}
          />

          {ALL_MUSCLES.map((muscle) =>
            MUSCLE_PATHS[muscle]
              .filter((p) => p.side === 'back')
              .map((p, idx) => (
                <AnimatedMusclePath
                  key={`back-${muscle}-${idx}`}
                  d={p.d}
                  intensity={heatmap[muscle]}
                  isOvertrained={overtrainSet.has(muscle)}
                  onPress={onMusclePress ? () => onMusclePress(muscle) : undefined}
                />
              ))
          )}
        </>
      )}
    </Svg>
  );
}

export default memo(MuscleHeatmapSVGComponent);

// Local muscle-heatmap palette (decoupled from WORKOUT_THEME after the
// monochrome workout redesign — these stay green-scale by design here).
const MUSCLE_HEATMAP_PALETTE = {
  untrained: 'rgba(255,255,255,0.06)',
  light: '#1D8B41',
  moderate: '#30D158',
  heavy: '#FF9F0A',
  overtrain: '#FF453A',
} as const;

export const INTENSITY_LABELS = ['Untrained', 'Light', 'Moderate', 'Heavy'] as const;
export const INTENSITY_COLORS = [
  MUSCLE_HEATMAP_PALETTE.untrained,
  MUSCLE_HEATMAP_PALETTE.light,
  MUSCLE_HEATMAP_PALETTE.moderate,
  MUSCLE_HEATMAP_PALETTE.heavy,
] as const;
export const OVERTRAIN_COLOR = MUSCLE_HEATMAP_PALETTE.overtrain;
