import type { SleepPhaseTimelineRow } from '@project-delta/shared';

export type SleepHypnogramPhase = Pick<
  SleepPhaseTimelineRow,
  'id' | 'cycle_number' | 'stage' | 'start_time' | 'end_time' | 'duration_minutes' | 'confidence'
>;

export type HypnogramStage = SleepHypnogramPhase['stage'];

export interface HypnogramInput {
  phases: SleepHypnogramPhase[];
  sessionStart: string;
  sessionEnd: string;
  width: number;
  height: number;
}

export interface HypnogramTick {
  timeMs: number;
  x: number;
  isMajor: boolean;
}

export interface HypnogramBandLayout {
  awake: { top: number; height: number };
  rem: { top: number; height: number };
  core: { top: number; height: number };
  deep: { top: number; height: number };
  gap: number;
}

export interface HypnogramSegment {
  id: string;
  stage: HypnogramStage;
  startMs: number;
  endMs: number;
  xStart: number;
  xEnd: number;
  width: number;
  confidence: SleepHypnogramPhase['confidence'];
  cycleNumber: number;
}

export interface HypnogramGeometry {
  ticks: HypnogramTick[];
  segments: HypnogramSegment[];
  gaps: {
    id: string;
    startMs: number;
    endMs: number;
    xStart: number;
    xEnd: number;
    width: number;
    lowConfidence: boolean;
  }[];
  cycleBoundaries: {
    cycleNumber: number;
    timeMs: number;
    x: number;
  }[];
  t0: number;
  t1: number;
}

export const MERGING_THRESHOLD_MS = 15_000;
export const TRANSITION_OVERLAP_MS = 3_000;
const SHORT_TRANSITION_MS = 10_000;

const BAND_FRACTIONS = {
  awake: 0.06,
  rem: 0.22,
  core: 0.36,
  deep: 0.36,
} as const;

const CONFIDENCE_WEIGHT: Record<SleepHypnogramPhase['confidence'], number> = {
  low: 0.6,
  medium: 0.86,
  high: 1,
};

const STAGE_ORDER: HypnogramStage[] = ['deep', 'light', 'rem', 'awake'];

function parsePhase(phase: SleepHypnogramPhase): SleepHypnogramPhase | null {
  const startMs = new Date(phase.start_time).getTime();
  const endMs = new Date(phase.end_time).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  return phase;
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

function withWindow(
  phase: SleepHypnogramPhase,
  startMs: number,
  endMs: number
): SleepHypnogramPhase {
  return {
    ...phase,
    start_time: new Date(startMs).toISOString(),
    end_time: new Date(endMs).toISOString(),
    duration_minutes: Math.max(0, Math.round((endMs - startMs) / 60_000)),
  };
}

function dominateStage(
  candidateA: SleepHypnogramPhase,
  candidateB: SleepHypnogramPhase
): SleepHypnogramPhase['stage'] {
  const aScore =
    (toMs(candidateA.end_time) - toMs(candidateA.start_time)) *
    CONFIDENCE_WEIGHT[candidateA.confidence];
  const bScore =
    (toMs(candidateB.end_time) - toMs(candidateB.start_time)) *
    CONFIDENCE_WEIGHT[candidateB.confidence];
  if (aScore === bScore) {
    return STAGE_ORDER.indexOf(candidateA.stage) >= STAGE_ORDER.indexOf(candidateB.stage)
      ? candidateA.stage
      : candidateB.stage;
  }
  return aScore > bScore ? candidateA.stage : candidateB.stage;
}

export function buildBandLayout(_width: number, _height: number): HypnogramBandLayout {
  const sBase = Math.max(4, Math.floor((_width / 360) * 4));
  const gap = sBase;
  const availableHeight = Math.max(1, _height - gap * 3);
  const awakeHeight = availableHeight * BAND_FRACTIONS.awake;
  const remHeight = availableHeight * BAND_FRACTIONS.rem;
  const coreHeight = availableHeight * BAND_FRACTIONS.core;
  const deepHeight = availableHeight * BAND_FRACTIONS.deep;
  const awakeTop = 0;
  const remTop = awakeTop + awakeHeight + gap;
  const coreTop = remTop + remHeight + gap;
  const deepTop = coreTop + coreHeight + gap;
  return {
    awake: { top: awakeTop, height: awakeHeight },
    rem: { top: remTop, height: remHeight },
    core: { top: coreTop, height: coreHeight },
    deep: { top: deepTop, height: deepHeight },
    gap,
  };
}

export function selectGridIntervalMs(_startMs: number, _endMs: number): number {
  const span = _endMs - _startMs;
  if (span <= 6 * 3_600_000) {
    return 30 * 60_000;
  }
  if (span <= 12 * 3_600_000) {
    return 60 * 60_000;
  }
  return 2 * 60 * 60_000;
}

export function mapTimeToX(
  _timeMs: number,
  _startMs: number,
  _endMs: number,
  _chartWidth: number
): number {
  if (_endMs <= _startMs || _chartWidth <= 0) {
    return 0;
  }
  const ratio = (_timeMs - _startMs) / (_endMs - _startMs);
  const bounded = Math.max(0, Math.min(1, ratio));
  return bounded * _chartWidth;
}

export function coalescePhases(_phases: SleepHypnogramPhase[]): SleepHypnogramPhase[] {
  const sorted = _phases
    .map(parsePhase)
    .filter((phase): phase is SleepHypnogramPhase => phase !== null)
    .sort((a, b) => toMs(a.start_time) - toMs(b.start_time));

  if (!sorted.length) {
    return [];
  }

  const merged: SleepHypnogramPhase[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(current);
      continue;
    }

    const lastEnd = toMs(last.end_time);
    const currentStart = toMs(current.start_time);
    const sameStage = last.stage === current.stage;
    const gap = currentStart - lastEnd;
    if (sameStage && gap <= MERGING_THRESHOLD_MS) {
      merged[merged.length - 1] = withWindow(
        last,
        toMs(last.start_time),
        Math.max(lastEnd, toMs(current.end_time))
      );
      continue;
    }
    merged.push(current);
  }

  for (let i = 1; i < merged.length; i += 1) {
    const prev = merged[i - 1];
    const next = merged[i];
    const prevEnd = toMs(prev.end_time);
    const nextStart = toMs(next.start_time);
    const delta = nextStart - prevEnd;
    if (Math.abs(delta) <= TRANSITION_OVERLAP_MS) {
      const midpoint = Math.round((prevEnd + nextStart) / 2);
      merged[i - 1] = withWindow(prev, toMs(prev.start_time), midpoint);
      merged[i] = withWindow(next, midpoint, toMs(next.end_time));
    }
  }

  for (let i = 1; i < merged.length - 1; i += 1) {
    const current = merged[i];
    const duration = toMs(current.end_time) - toMs(current.start_time);
    if (duration >= SHORT_TRANSITION_MS) {
      continue;
    }
    const prev = merged[i - 1];
    const next = merged[i + 1];
    const dominantStage = dominateStage(prev, next);
    if (dominantStage !== current.stage) {
      merged[i] = { ...current, stage: dominantStage };
    }
  }

  return merged;
}

export function buildHypnogramGeometry(_input: HypnogramInput): HypnogramGeometry {
  const t0 = new Date(_input.sessionStart).getTime();
  const t1 = new Date(_input.sessionEnd).getTime();
  if (
    !Number.isFinite(t0) ||
    !Number.isFinite(t1) ||
    t1 <= t0 ||
    _input.width <= 0 ||
    _input.height <= 0
  ) {
    return { ticks: [], segments: [], gaps: [], cycleBoundaries: [], t0: 0, t1: 0 };
  }

  const normalized = coalescePhases(_input.phases);
  const segments = normalized.map((phase) => {
    const startMs = toMs(phase.start_time);
    const endMs = toMs(phase.end_time);
    const xStart = Math.floor(mapTimeToX(startMs, t0, t1, _input.width));
    const xEnd = Math.floor(mapTimeToX(endMs, t0, t1, _input.width));
    const width = Math.max(2, xEnd - xStart);
    return {
      id: phase.id,
      stage: phase.stage,
      startMs,
      endMs,
      xStart,
      xEnd,
      width,
      confidence: phase.confidence,
      cycleNumber: phase.cycle_number,
    };
  });
  const gaps: HypnogramGeometry['gaps'] = [];
  const cycleBoundaryMap = new Map<number, number>();

  for (let i = 0; i < normalized.length - 1; i += 1) {
    const current = normalized[i];
    const next = normalized[i + 1];
    const currentEnd = toMs(current.end_time);
    const nextStart = toMs(next.start_time);
    if (nextStart > currentEnd) {
      const xStart = Math.floor(mapTimeToX(currentEnd, t0, t1, _input.width));
      const xEnd = Math.floor(mapTimeToX(nextStart, t0, t1, _input.width));
      gaps.push({
        id: `gap-${i}`,
        startMs: currentEnd,
        endMs: nextStart,
        xStart,
        xEnd,
        width: Math.max(1, xEnd - xStart),
        lowConfidence: current.confidence === 'low' || next.confidence === 'low',
      });
    }

    if (next.cycle_number > current.cycle_number) {
      cycleBoundaryMap.set(next.cycle_number, nextStart);
    }
  }

  const cycleBoundaries = Array.from(cycleBoundaryMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([cycleNumber, timeMs]) => ({
      cycleNumber,
      timeMs,
      x: mapTimeToX(timeMs, t0, t1, _input.width),
    }));

  const ticks: HypnogramTick[] = [];
  const intervalMs = selectGridIntervalMs(t0, t1);
  const firstTick = Math.ceil(t0 / intervalMs) * intervalMs;
  let tickIndex = 0;
  for (let tickMs = firstTick; tickMs <= t1; tickMs += intervalMs) {
    ticks.push({
      timeMs: tickMs,
      x: mapTimeToX(tickMs, t0, t1, _input.width),
      isMajor: tickIndex % 2 === 0,
    });
    tickIndex += 1;
  }

  return {
    ticks,
    segments,
    gaps,
    cycleBoundaries,
    t0,
    t1,
  };
}
