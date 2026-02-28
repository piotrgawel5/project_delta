import { buildHypnogramDataFromTimeline } from '../hypnogramTimeline';

describe('buildHypnogramDataFromTimeline', () => {
  it('returns null for empty input', () => {
    const result = buildHypnogramDataFromTimeline({ phases: [] });
    expect(result).toEqual({ data: null, droppedRows: 0 });
  });

  it('sorts by start_time and maps rows to sleep hypnogram phases', () => {
    const result = buildHypnogramDataFromTimeline({
      phases: [
        {
          id: '2',
          stage: 'deep',
          cycle_number: 1,
          start_time: '2026-02-10T00:40:00.000Z',
          end_time: '2026-02-10T01:20:00.000Z',
          duration_minutes: 999,
          confidence: 'medium',
        },
        {
          id: '1',
          stage: 'light',
          cycle_number: 1,
          start_time: '2026-02-10T00:00:00.000Z',
          end_time: '2026-02-10T00:40:00.000Z',
          duration_minutes: 5,
          confidence: 'high',
        },
      ],
    });

    expect(result.droppedRows).toBe(0);
    expect(result.data).not.toBeNull();
    expect(result.data?.sleepOnsetMin).toBe(0);
    expect(result.data?.wakeMin).toBe(80);
    expect(result.data?.phases).toEqual([
      {
        stage: 'light',
        startMin: 0,
        durationMin: 40,
        cycleNumber: 1,
        confidence: 'high',
      },
      {
        stage: 'deep',
        startMin: 40,
        durationMin: 40,
        cycleNumber: 1,
        confidence: 'medium',
      },
    ]);
  });

  it('drops invalid rows deterministically', () => {
    const result = buildHypnogramDataFromTimeline({
      phases: [
        {
          id: 'ok',
          stage: 'awake',
          cycle_number: 0,
          start_time: '2026-02-10T02:00:00.000Z',
          end_time: '2026-02-10T02:05:00.000Z',
          duration_minutes: 5,
          confidence: 'low',
        },
        {
          id: 'bad-time',
          stage: 'light',
          cycle_number: 1,
          start_time: 'x',
          end_time: '2026-02-10T02:10:00.000Z',
          duration_minutes: 10,
          confidence: 'low',
        },
        {
          id: 'bad-order',
          stage: 'rem',
          cycle_number: 1,
          start_time: '2026-02-10T02:10:00.000Z',
          end_time: '2026-02-10T02:09:00.000Z',
          duration_minutes: 1,
          confidence: 'low',
        },
      ],
    });

    expect(result.droppedRows).toBe(2);
    expect(result.data?.phases.length).toBe(1);
    expect(result.data?.phases[0].stage).toBe('awake');
  });

  it('maps rem to core', () => {
    const result = buildHypnogramDataFromTimeline({
      phases: [
        {
          id: 'r1',
          stage: 'rem',
          cycle_number: 1,
          start_time: '2026-02-10T03:00:00.000Z',
          end_time: '2026-02-10T03:30:00.000Z',
          duration_minutes: 30,
          confidence: 'high',
        },
      ],
    });

    expect(result.droppedRows).toBe(0);
    expect(result.data?.phases[0].stage).toBe('core');
  });
});
