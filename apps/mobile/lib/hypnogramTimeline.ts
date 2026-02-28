import type { SleepHypnogramData, SleepPhase } from '@project-delta/shared';

export type TimelineStage = 'awake' | 'light' | 'deep' | 'rem';
export type TimelineConfidence = 'high' | 'medium' | 'low';

export interface TimelinePhaseLike {
  id: string;
  cycle_number: number;
  stage: TimelineStage;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  confidence: TimelineConfidence;
}

export interface BuildHypnogramDataParams {
  phases: TimelinePhaseLike[];
}

export interface BuildHypnogramDataResult {
  data: SleepHypnogramData | null;
  droppedRows: number;
}

export type HypnogramTimelinePhase = SleepPhase;

const STAGE_SET = new Set<TimelineStage>(['awake', 'light', 'deep', 'rem']);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toMs(iso: string): number {
  return new Date(iso).getTime();
}

export function buildHypnogramDataFromTimeline(
  params: BuildHypnogramDataParams
): BuildHypnogramDataResult {
  const input = Array.isArray(params.phases) ? params.phases : [];
  if (!input.length) {
    return { data: null, droppedRows: 0 };
  }

  const candidates: {
    stage: SleepPhase['stage'];
    cycleNumber: number;
    confidence: SleepPhase['confidence'];
    startMs: number;
    endMs: number;
    durationMin: number;
  }[] = [];

  let droppedRows = 0;

  for (const row of input) {
    if (!row || !STAGE_SET.has(row.stage)) {
      droppedRows += 1;
      continue;
    }

    const startMs = toMs(row.start_time);
    const endMs = toMs(row.end_time);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      droppedRows += 1;
      continue;
    }

    const derivedDuration = Math.round((endMs - startMs) / 60_000);
    if (!isFiniteNumber(derivedDuration) || derivedDuration <= 0) {
      droppedRows += 1;
      continue;
    }

    const cycleNumber = isFiniteNumber(row.cycle_number)
      ? Math.max(0, Math.round(row.cycle_number))
      : 0;

    const normalizedStage: SleepPhase['stage'] = row.stage === 'rem' ? 'core' : row.stage;

    candidates.push({
      stage: normalizedStage,
      cycleNumber,
      confidence: row.confidence,
      startMs,
      endMs,
      durationMin: derivedDuration,
    });
  }

  if (!candidates.length) {
    return { data: null, droppedRows };
  }

  candidates.sort((a, b) => a.startMs - b.startMs);
  const sessionStartMs = candidates[0].startMs;
  const sessionEndMs = Math.max(...candidates.map((phase) => phase.endMs));
  const wakeMin = Math.round((sessionEndMs - sessionStartMs) / 60_000);

  if (!isFiniteNumber(wakeMin) || wakeMin <= 0) {
    return { data: null, droppedRows: droppedRows + candidates.length };
  }

  const phases: SleepPhase[] = [];
  for (const phase of candidates) {
    const startMin = Math.round((phase.startMs - sessionStartMs) / 60_000);
    if (!isFiniteNumber(startMin) || startMin < 0) {
      droppedRows += 1;
      continue;
    }

    phases.push({
      stage: phase.stage,
      startMin,
      durationMin: phase.durationMin,
      cycleNumber: phase.cycleNumber,
      confidence: phase.confidence,
    });
  }

  if (!phases.length) {
    return { data: null, droppedRows };
  }

  return {
    data: {
      phases,
      sleepOnsetMin: 0,
      wakeMin,
    },
    droppedRows,
  };
}
