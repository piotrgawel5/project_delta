import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop, Path } from 'react-native-svg';
import type { SleepHypnogramData, SleepPhase, SleepStage } from '@project-delta/shared';

interface SleepHypnogramProps {
  data: SleepHypnogramData;
  isPaidPlan: boolean;
  isLoading?: boolean;
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
  rem: 1,
  core: 1,
  light: 2,
  deep: 3,
};

const ROW_HEIGHT = 40;
const ROW_GAP = 20;
const SVG_HEIGHT = 4 * ROW_HEIGHT + 3 * ROW_GAP;
const MIN_SEGMENT_WIDTH = 2;
const MERGE_GAP_MIN = 1;
const BLOCK_INSET = 2;
const OUTER_BLOCK_OPACITY = 0.4;
const CONNECTOR_WIDTH = 3;
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

// A single vertical rect connecting bottom of cur block to top of nxt block (or vice versa).
// x is the right edge of the current block, width = CONNECTOR_WIDTH.
type VerticalConnector = {
  key: string;
  gradientId: string;
  fromIndex: number;
  x: number;
  y: number;
  height: number;
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
  if (totalDuration <= 0 || chartWidth <= 0) return [];

  const sorted = phases
    .filter((p) => isFiniteNumber(p.startMin) && isFiniteNumber(p.durationMin))
    .filter((p) => p.durationMin > 0)
    .map((p) => {
      const start = Math.max(sleepOnsetMin, p.startMin);
      const end = Math.min(wakeMin, p.startMin + p.durationMin);
      return { ...p, startMin: start, durationMin: Math.max(0, end - start) };
    })
    .filter((p) => p.durationMin > 0)
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
      if (trimmedDuration > 0)
        merged.push({ ...phase, startMin: trimmedStart, durationMin: trimmedDuration });
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

function applyConnectorOverlapShift(phases: RenderPhase[]): RenderPhase[] {
  if (phases.length <= 1) return phases;
  return phases.map((phase, idx) =>
    idx === 0
      ? phase
      : {
          ...phase,
          x: Math.max(0, phase.x - idx * CONNECTOR_WIDTH),
        }
  );
}

function stretchPhasesToChartWidth(phases: RenderPhase[], chartWidth: number): RenderPhase[] {
  if (phases.length === 0 || chartWidth <= 0) return phases;

  const minX = phases[0].x;
  const maxEnd = phases.reduce((acc, phase) => Math.max(acc, phase.x + phase.width), 0);
  const span = maxEnd - minX;
  if (span <= 0) return phases;

  const scale = chartWidth / span;
  if (!Number.isFinite(scale) || scale <= 0) return phases;

  return phases.map((phase) => ({
    ...phase,
    x: (phase.x - minX) * scale,
    width: phase.width * scale,
  }));
}

function buildOuterCornerConfigs(phases: RenderPhase[]): OuterCornerConfig[] {
  const corners = phases.map(() => ({ tl: true, tr: true, br: true, bl: true }));
  for (let i = 0; i < phases.length - 1; i += 1) {
    const cur = phases[i];
    const nxt = phases[i + 1];
    if (nxt.row > cur.row) {
      corners[i].br = false;
      corners[i + 1].tl = false;
    } else if (nxt.row < cur.row) {
      corners[i].tr = false;
      corners[i + 1].bl = false;
    }
  }
  return corners;
}

function buildVerticalConnectors(phases: RenderPhase[]): VerticalConnector[] {
  const connectors: VerticalConnector[] = [];

  for (let i = 0; i < phases.length - 1; i += 1) {
    const cur = phases[i];
    const nxt = phases[i + 1];
    if (cur.row === nxt.row) continue;

    // Anchor connector flush with the current block's flattened right corner.
    const x = Math.round(cur.x + cur.width - CONNECTOR_WIDTH);
    const goesDown = cur.row < nxt.row;
    const top = goesDown ? cur.y + cur.height : nxt.y + nxt.height;
    const bot = goesDown ? nxt.y : cur.y;

    const height = Math.max(0, bot - top);
    if (height === 0) continue;

    connectors.push({
      key: `vc-${i}`,
      gradientId: `vcg-${i}`,
      fromIndex: i,
      x,
      y: top,
      height,
      // Gradient is always top -> bottom in screen space.
      startColor: goesDown ? cur.fill : nxt.fill,
      endColor: goesDown ? nxt.fill : cur.fill,
    });
  }

  return connectors;
}

function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  corners: OuterCornerConfig,
  radius: number
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const tl = corners.tl ? r : 0;
  const tr = corners.tr ? r : 0;
  const br = corners.br ? r : 0;
  const bl = corners.bl ? r : 0;
  return [
    `M ${x + tl} ${y}`,
    `H ${x + width - tr}`,
    tr > 0 ? `A ${tr} ${tr} 0 0 1 ${x + width} ${y + tr}` : `L ${x + width} ${y}`,
    `V ${y + height - br}`,
    br > 0 ? `A ${br} ${br} 0 0 1 ${x + width - br} ${y + height}` : `L ${x + width} ${y + height}`,
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
  const { sleepOnsetMin, wakeMin } = data;
  const totalDuration = wakeMin - sleepOnsetMin;
  const canRenderPhases = isPaidPlan && !isLoading && totalDuration > 0;

  const renderPhases = useMemo(
    () => {
      const normalized = normalizePhases(data.phases, sleepOnsetMin, wakeMin, chartWidth);
      const totalOverlapShift = Math.max(0, (normalized.length - 1) * CONNECTOR_WIDTH);
      const stretched = stretchPhasesToChartWidth(normalized, chartWidth + totalOverlapShift);
      return applyConnectorOverlapShift(stretched);
    },
    [chartWidth, data.phases, sleepOnsetMin, wakeMin]
  );
  const outerCornerConfigs = useMemo(() => buildOuterCornerConfigs(renderPhases), [renderPhases]);
  const verticalConnectors = useMemo(() => buildVerticalConnectors(renderPhases), [renderPhases]);
  const connectorByFromIndex = useMemo(
    () => new Map(verticalConnectors.map((c) => [c.fromIndex, c])),
    [verticalConnectors]
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
            {verticalConnectors.map((c) => (
              <LinearGradient
                key={c.gradientId}
                id={c.gradientId}
                x1={c.x}
                y1={c.y}
                x2={c.x}
                y2={c.y + c.height}
                gradientUnits="userSpaceOnUse">
                <Stop offset="0%" stopColor={c.startColor} />
                <Stop offset="100%" stopColor={c.endColor} />
              </LinearGradient>
            ))}
          </Defs>

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
              {phase.width > BLOCK_INSET * 2 && phase.height > BLOCK_INSET * 2 && (
                <Rect
                  x={phase.x + BLOCK_INSET}
                  y={phase.y + BLOCK_INSET}
                  width={phase.width - BLOCK_INSET * 2}
                  height={phase.height - BLOCK_INSET * 2}
                  rx={INNER_BLOCK_RADIUS}
                  fill={phase.fill}
                />
              )}
              {(() => {
                const connector = connectorByFromIndex.get(idx);
                if (!connector) return null;
                return (
                  <Rect
                    key={connector.key}
                    x={connector.x}
                    y={connector.y}
                    width={CONNECTOR_WIDTH}
                    height={connector.height}
                    fill={`url(#${connector.gradientId})`}
                    opacity={OUTER_BLOCK_OPACITY}
                  />
                );
              })()}
            </React.Fragment>
          ))}
        </>
      ) : null}
    </Svg>
  );
});

export default SleepHypnogram;
