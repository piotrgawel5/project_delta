// lib/useMorningBrief.ts
//
// Hook that wires the three stores (sleep, workout, nutrition) into the pure
// `buildMorningBrief` composer. Each underlying selector is granular per the
// CLAUDE.md rule — we never call `useFooStore()` without a selector.

import { useMemo } from 'react';
import { useSleepStore } from '@store/sleepStore';
import { useWorkoutStore } from '@store/workoutStore';
import { useNutritionStore } from '@store/nutritionStore';
import { useProfileStore } from '@store/profileStore';
import type { SleepInsight } from '@components/sleep/InsightCard';
import { buildMorningBrief } from './morningBrief';
import { buildMorningBriefInput } from './morningBriefSelectors';

const selectSleepHistory = (s: ReturnType<typeof useSleepStore.getState>) => s.recentHistory;
const selectSessions = (s: ReturnType<typeof useWorkoutStore.getState>) => s.sessions;
const selectLogsByDate = (s: ReturnType<typeof useNutritionStore.getState>) => s.logsByDate;
const selectProfile = (s: ReturnType<typeof useProfileStore.getState>) => s.profile;

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useMorningBrief(): SleepInsight {
  const sleepHistory = useSleepStore(selectSleepHistory);
  const sessions = useWorkoutStore(selectSessions);
  const logsByDate = useNutritionStore(selectLogsByDate);
  const profile = useProfileStore(selectProfile);

  return useMemo(() => {
    const input = buildMorningBriefInput({
      todayDate: todayDate(),
      sleepHistory,
      sessions,
      logsByDate,
      profile,
    });
    return buildMorningBrief(input);
  }, [sleepHistory, sessions, logsByDate, profile]);
}
