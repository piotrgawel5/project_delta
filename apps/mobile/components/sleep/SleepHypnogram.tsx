import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
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
const ROW_GAP = 10;
const SVG_HEIGHT = 4 * ROW_HEIGHT + 3 * ROW_GAP;
const MIN_SEGMENT_WIDTH = 2;
const MERGE_GAP_MIN = 1;
const BLOCK_INSET = 2;
const OUTER_BLOCK_OPACITY = 0.4;
const CONNECTOR_WIDTH = 4;
const INNER_BLOCK_RADIUS = 5;
const OUTER_BLOCK_RADIUS = INNER_BLOCK_RADIUS + BLOCK_INSET;

type RenderPhase = {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  fill: string;
};

type OuterCornerConfig = {
  tl: boolean;
  tr: boolean;
  br: boolean;
  bl: boolean;
};

type TransitionConnector = {
  key: string;
  gradientId: string;
  pathD: string;
  gx1: number;
  gy1: number;
  gx2: number;
  gy2: number;
  startColor: string;
  endColor: string;
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
      row,
      fill: STAGE_COLOR[phase.stage],
    };
  });
}

function buildOuterCornerConfigs(phases: RenderPhase[]): OuterCornerConfig[] {
  const corners = phases.map(() => ({ tl: true, tr: true, br: true, bl: true }));

  for (let i = 0; i < phases.length - 1; i += 1) {
    const current = phases[i];
    const next = phases[i + 1];

    if (next.row > current.row) {
      corners[i].br = false;
      corners[i + 1].tl = false;
    } else if (next.row < current.row) {
      corners[i].tr = false;
      corners[i + 1].bl = false;
    }
  }

  return corners;
}

function buildTransitionConnectors(phases: RenderPhase[]): TransitionConnector[] {
  const connectors: TransitionConnector[] = [];

  for (let i = 0; i < phases.length - 1; i += 1) {
    const current = phases[i];
    const next = phases[i + 1];
    const keyBase = `${current.key}-${next.key}-${i}`;

    if (next.row > current.row) {
      const x1 = current.x + current.width;
      const y1 = current.y + current.height;
      const x2 = next.x;
      const y2 = next.y;
      connectors.push({
        key: `connector-down-${keyBase}`,
        gradientId: `connector-grad-down-${keyBase}`,
        pathD: connectorPathFromAnchoredEdge(x1, y1, x2, y2, CONNECTOR_WIDTH),
        gx1: x1,
        gy1: y1,
        gx2: x2,
        gy2: y2,
        startColor: current.fill,
        endColor: next.fill,
      });
    } else if (next.row < current.row) {
      const x1 = current.x + current.width;
      const y1 = current.y;
      const x2 = next.x;
      const y2 = next.y + next.height;
      connectors.push({
        key: `connector-up-${keyBase}`,
        gradientId: `connector-grad-up-${keyBase}`,
        pathD: connectorPathFromAnchoredEdge(x1, y1, x2, y2, CONNECTOR_WIDTH),
        gx1: x1,
        gy1: y1,
        gx2: x2,
        gy2: y2,
        startColor: current.fill,
        endColor: next.fill,
      });
    }
  }

  return connectors;
}

function connectorPathFromAnchoredEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (length <= 0) {
    return `M ${x1} ${y1} Z`;
  }

  const nx = (-dy / length) * width;
  const ny = (dx / length) * width;

  return `M ${x1} ${y1} L ${x2} ${y2} L ${x2 + nx} ${y2 + ny} L ${x1 + nx} ${y1 + ny} Z`;
}

function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  corners: OuterCornerConfig,
  radius: number
): string {
  const maxRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  const tl = corners.tl ? maxRadius : 0;
  const tr = corners.tr ? maxRadius : 0;
  const br = corners.br ? maxRadius : 0;
  const bl = corners.bl ? maxRadius : 0;

  return [
    `M ${x + tl} ${y}`,
    `H ${x + width - tr}`,
    tr > 0 ? `A ${tr} ${tr} 0 0 1 ${x + width} ${y + tr}` : `L ${x + width} ${y}`,
    `V ${y + height - br}`,
    br > 0
      ? `A ${br} ${br} 0 0 1 ${x + width - br} ${y + height}`
      : `L ${x + width} ${y + height}`,
    `H ${x + bl}`,
    bl > 0 ? `A ${bl} ${bl} 0 0 1 ${x} ${y + height - bl}` : `L ${x} ${y + height}`,
    `V ${y + tl}`,
    tl > 0 ? `A ${tl} ${tl} 0 0 1 ${x + tl} ${y}` : `L ${x} ${y}`,
    'Z',
  ].join(' ');
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
  const outerCornerConfigs = useMemo(() => buildOuterCornerConfigs(renderPhases), [renderPhases]);
  const transitionConnectors = useMemo(
    () => buildTransitionConnectors(renderPhases),
    [renderPhases]
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

      {canRenderPhases ? (
        <>
          <Defs>
            {transitionConnectors.map((connector) => (
              <LinearGradient
                key={connector.gradientId}
                id={connector.gradientId}
                x1={connector.gx1}
                y1={connector.gy1}
                x2={connector.gx2}
                y2={connector.gy2}
                gradientUnits="userSpaceOnUse"
              >
                <Stop offset="0%" stopColor={connector.startColor} />
                <Stop offset="100%" stopColor={connector.endColor} />
              </LinearGradient>
            ))}
          </Defs>

          {transitionConnectors.map((connector) => (
            <Path
              key={connector.key}
              d={connector.pathD}
              fill={`url(#${connector.gradientId})`}
              opacity={OUTER_BLOCK_OPACITY}
            />
          ))}

          {renderPhases.map((phase, idx) => (
            <React.Fragment key={phase.key}>
              <Path
                d={roundedRectPath(
                  phase.x,
                  phase.y,
                  phase.width,
                  phase.height,
                  outerCornerConfigs[idx],
                  OUTER_BLOCK_RADIUS
                )}
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
          ))}
        </>
      ) : null}
    </Svg>
  );
});

export default SleepHypnogram;
