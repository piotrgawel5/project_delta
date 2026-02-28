import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { SleepHypnogramData, SleepPhase, SleepStage } from '@project-delta/shared';

interface SleepHypnogramProps {
  data: SleepHypnogramData;
  isPaidPlan: boolean;
  isLoading?: boolean;
  /** Defaults to full screen width. Pass explicit value if inside a constrained container. */
  width?: number;
}

const STAGE_COLOR: Record<SleepStage, string> = {
  awake: '#ff5900',
  light: '#00ffea',
  rem: '#4D96FF',
  core: '#4D96FF',
  deep: '#A855F7',
};

const STAGE_ROW: Record<SleepStage, number> = {
  awake: 0,
  light: 1,
  rem: 2,
  core: 2,
  deep: 3,
};

const ROW_HEIGHT = 40;
const ROW_GAP = 8;
const SVG_HEIGHT = 4 * ROW_HEIGHT + 3 * ROW_GAP;
const MIN_SEGMENT_WIDTH = 2;
const MERGE_GAP_MIN = 1;
const BLOCK_INSET = 2;
const OUTER_BLOCK_OPACITY = 0.4;
const INNER_BLOCK_RADIUS = 5;
const OUTER_BLOCK_RADIUS = INNER_BLOCK_RADIUS + BLOCK_INSET;

type RenderPhase = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizePhases(
  phases: SleepPhase[],
  sleepOnsetMin: number,
  wakeMin: number,
  chartWidth: number
): RenderPhase[] {
  const totalDuration = wakeMin - sleepOnsetMin;
  if (totalDuration <= 0 || chartWidth <= 0) {
    return [];
  }

  const sorted = phases
    .filter((phase) => isFiniteNumber(phase.startMin) && isFiniteNumber(phase.durationMin))
    .filter((phase) => phase.durationMin > 0)
    .map((phase) => {
      const start = Math.max(sleepOnsetMin, phase.startMin);
      const end = Math.min(wakeMin, phase.startMin + phase.durationMin);
      return {
        ...phase,
        startMin: start,
        durationMin: Math.max(0, end - start),
      };
    })
    .filter((phase) => phase.durationMin > 0)
    .sort((a, b) => a.startMin - b.startMin);

  const merged: SleepPhase[] = [];
  for (const phase of sorted) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push(phase);
      continue;
    }

    const prevEnd = prev.startMin + prev.durationMin;
    const gap = phase.startMin - prevEnd;
    if (phase.stage === prev.stage && gap <= MERGE_GAP_MIN) {
      prev.durationMin = Math.max(
        0,
        Math.max(prevEnd, phase.startMin + phase.durationMin) - prev.startMin
      );
      continue;
    }

    if (phase.startMin < prevEnd) {
      const trimmedStart = prevEnd;
      const trimmedDuration = phase.startMin + phase.durationMin - trimmedStart;
      if (trimmedDuration > 0) {
        merged.push({
          ...phase,
          startMin: trimmedStart,
          durationMin: trimmedDuration,
        });
      }
      continue;
    }

    merged.push(phase);
  }

  return merged.map((phase, idx) => {
    const x = ((phase.startMin - sleepOnsetMin) / totalDuration) * chartWidth;
    const width = Math.max(MIN_SEGMENT_WIDTH, (phase.durationMin / totalDuration) * chartWidth);
    const row = STAGE_ROW[phase.stage];
    const y = row * (ROW_HEIGHT + ROW_GAP);
    return {
      key: `${phase.stage}-${phase.startMin}-${phase.durationMin}-${idx}`,
      x,
      y,
      width,
      height: ROW_HEIGHT,
      fill: STAGE_COLOR[phase.stage],
    };
  });
}

const SleepHypnogram = React.memo(function SleepHypnogram({
  data,
  isPaidPlan,
  isLoading = false,
  width: widthProp,
}: SleepHypnogramProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = Math.max(1, Math.floor(widthProp ?? screenWidth));
  const sleepOnsetMin = data.sleepOnsetMin;
  const wakeMin = data.wakeMin;
  const totalDuration = wakeMin - sleepOnsetMin;
  const canRenderPhases = isPaidPlan && !isLoading && totalDuration > 0;

  const renderPhases = useMemo(
    () => normalizePhases(data.phases, sleepOnsetMin, wakeMin, chartWidth),
    [chartWidth, data.phases, sleepOnsetMin, wakeMin]
  );

  return (
    <Svg width={chartWidth} height={SVG_HEIGHT}>
      {[0, 1, 2, 3].map((i) => (
        <Rect
          key={`bg-${i}`}
          x={0}
          y={i * (ROW_HEIGHT + ROW_GAP)}
          width={chartWidth}
          height={ROW_HEIGHT}
          fill={i % 2 === 0 ? '#111' : '#222'}
        />
      ))}

      {canRenderPhases
        ? renderPhases.map((phase) => (
            <React.Fragment key={phase.key}>
              <Rect
                x={phase.x}
                y={phase.y}
                width={phase.width}
                height={phase.height}
                rx={OUTER_BLOCK_RADIUS}
                fill={phase.fill}
                opacity={OUTER_BLOCK_OPACITY}
              />
              {phase.width > BLOCK_INSET * 2 && phase.height > BLOCK_INSET * 2 ? (
                <Rect
                  x={phase.x + BLOCK_INSET}
                  y={phase.y + BLOCK_INSET}
                  width={phase.width - BLOCK_INSET * 2}
                  height={phase.height - BLOCK_INSET * 2}
                  rx={INNER_BLOCK_RADIUS}
                  fill={phase.fill}
                />
              ) : null}
            </React.Fragment>
          ))
        : null}
    </Svg>
  );
});

export default SleepHypnogram;
