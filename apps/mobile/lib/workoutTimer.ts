import { useEffect, useRef, useState } from 'react';
import type { ActiveWorkoutSession } from '@store/workoutStore';

export function computeElapsedSeconds(session: ActiveWorkoutSession): number {
  const now = Date.now();
  const start = new Date(session.startedAt).getTime();
  // Open interval (currently paused): count up to now so display stays frozen
  const pausedMs = session.pausedIntervals.reduce((acc, interval) => {
    const end = interval.to ? new Date(interval.to).getTime() : now;
    return acc + (end - new Date(interval.from).getTime());
  }, 0);
  return Math.max(0, Math.floor((now - start - pausedMs) / 1000));
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Returns a formatted elapsed string that freezes while paused and resumes
// from the correct value. Uses a ref so the interval closure always reads
// the latest session without causing effect re-runs on every mutation.
export function useActiveTimer(session: ActiveWorkoutSession | null): string {
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const [elapsed, setElapsed] = useState(() =>
    session ? computeElapsedSeconds(session) : 0,
  );

  const isPaused = session?.isPaused ?? false;

  useEffect(() => {
    if (!session || isPaused) {
      if (session) setElapsed(computeElapsedSeconds(session));
      return;
    }
    const id = setInterval(() => {
      if (sessionRef.current) setElapsed(computeElapsedSeconds(sessionRef.current));
    }, 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  return formatElapsed(elapsed);
}
