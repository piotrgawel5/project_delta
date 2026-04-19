import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "@lib/api";
import type { WorkoutExerciseLog, WorkoutSession, WorkoutSet } from "@shared";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PausedInterval {
  from: string;
  to: string | null;
}

export interface ActiveWorkoutSession extends WorkoutSession {
  pausedIntervals: PausedInterval[];
  isPaused: boolean;
}

interface WorkoutStore {
  // Persisted session history (loaded from API)
  sessions: WorkoutSession[];
  isLoaded: boolean;
  error: string | null;

  // In-progress session (live tracking) — persisted to AsyncStorage
  activeSession: ActiveWorkoutSession | null;

  // Finished sessions waiting to reach the server — persisted to AsyncStorage
  syncQueue: WorkoutSession[];

  // Actions
  fetchSessions: (userId: string) => Promise<void>;
  startWorkout: (userId: string) => void;
  addExercise: (exerciseId: string) => void;
  logSet: (exerciseId: string, set: Omit<WorkoutSet, "id" | "completedAt">) => void;
  updateSet: (exerciseId: string, setId: string, updates: Partial<WorkoutSet>) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  removeExercise: (exerciseId: string) => void;
  pauseWorkout: () => void;
  resumeWorkout: () => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
  drainSyncQueue: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      isLoaded: false,
      error: null,
      activeSession: null,
      syncQueue: [],

      fetchSessions: async (userId: string) => {
        if (get().isLoaded) return;
        try {
          const resp = await api.get(`/api/workout/sessions/${userId}`);
          set({ sessions: resp.data as WorkoutSession[], isLoaded: true, error: null });
        } catch {
          set({ error: "Failed to load sessions", isLoaded: false });
        }
      },

      startWorkout: (userId: string) => {
        const now = new Date().toISOString();
        const session: ActiveWorkoutSession = {
          id: randomUUID(),
          userId,
          date: now.substring(0, 10),
          startedAt: now,
          finishedAt: null,
          durationSeconds: null,
          exercises: [],
          notes: null,
          pausedIntervals: [],
          isPaused: false,
        };
        set({ activeSession: session });
      },

      addExercise: (exerciseId: string) => {
        const { activeSession } = get();
        if (!activeSession) return;

        const alreadyAdded = activeSession.exercises.some((e) => e.exerciseId === exerciseId);
        if (alreadyAdded) return;

        const log: WorkoutExerciseLog = {
          exerciseId,
          sets: [],
          notes: null,
        };

        set({
          activeSession: {
            ...activeSession,
            exercises: [...activeSession.exercises, log],
          },
        });
      },

      logSet: (exerciseId: string, setData: Omit<WorkoutSet, "id" | "completedAt">) => {
        const { activeSession } = get();
        if (!activeSession) return;

        const newSet: WorkoutSet = {
          ...setData,
          id: randomUUID(),
          completedAt: new Date().toISOString(),
        };

        set({
          activeSession: {
            ...activeSession,
            exercises: activeSession.exercises.map((log) => {
              if (log.exerciseId !== exerciseId) return log;
              return { ...log, sets: [...log.sets, newSet] };
            }),
          },
        });
      },

      updateSet: (exerciseId: string, setId: string, updates: Partial<WorkoutSet>) => {
        const { activeSession } = get();
        if (!activeSession) return;

        set({
          activeSession: {
            ...activeSession,
            exercises: activeSession.exercises.map((log) => {
              if (log.exerciseId !== exerciseId) return log;
              return {
                ...log,
                sets: log.sets.map((s) => (s.id === setId ? { ...s, ...updates } : s)),
              };
            }),
          },
        });
      },

      removeSet: (exerciseId: string, setId: string) => {
        const { activeSession } = get();
        if (!activeSession) return;

        set({
          activeSession: {
            ...activeSession,
            exercises: activeSession.exercises.map((log) => {
              if (log.exerciseId !== exerciseId) return log;
              return {
                ...log,
                sets: log.sets
                  .filter((s) => s.id !== setId)
                  .map((s, i) => ({ ...s, setNumber: i + 1 })),
              };
            }),
          },
        });
      },

      removeExercise: (exerciseId: string) => {
        const { activeSession } = get();
        if (!activeSession) return;

        set({
          activeSession: {
            ...activeSession,
            exercises: activeSession.exercises.filter((log) => log.exerciseId !== exerciseId),
          },
        });
      },

      pauseWorkout: () => {
        const { activeSession } = get();
        if (!activeSession || activeSession.isPaused) return;
        set({
          activeSession: {
            ...activeSession,
            isPaused: true,
            pausedIntervals: [
              ...activeSession.pausedIntervals,
              { from: new Date().toISOString(), to: null },
            ],
          },
        });
      },

      resumeWorkout: () => {
        const { activeSession } = get();
        if (!activeSession || !activeSession.isPaused) return;
        const now = new Date().toISOString();
        set({
          activeSession: {
            ...activeSession,
            isPaused: false,
            pausedIntervals: activeSession.pausedIntervals.map((interval, i) =>
              i === activeSession.pausedIntervals.length - 1 && interval.to === null
                ? { ...interval, to: now }
                : interval,
            ),
          },
        });
      },

      finishWorkout: async () => {
        const { activeSession, sessions, syncQueue } = get();
        if (!activeSession) return;

        const finishedAt = new Date().toISOString();
        const startMs = new Date(activeSession.startedAt).getTime();
        const finishMs = new Date(finishedAt).getTime();

        const pausedMs = activeSession.pausedIntervals.reduce((acc, interval) => {
          const end = interval.to ?? finishedAt;
          return acc + (new Date(end).getTime() - new Date(interval.from).getTime());
        }, 0);

        const durationSeconds = Math.floor((finishMs - startMs - pausedMs) / 1000);

        const finishedSession: WorkoutSession = {
          id: activeSession.id,
          userId: activeSession.userId,
          date: activeSession.date,
          startedAt: activeSession.startedAt,
          finishedAt,
          durationSeconds,
          exercises: activeSession.exercises,
          notes: activeSession.notes,
        };

        // Optimistic update — add to local history immediately
        set({
          sessions: [finishedSession, ...sessions],
          activeSession: null,
          syncQueue: [...syncQueue, finishedSession],
        });

        void get().drainSyncQueue();
      },

      discardWorkout: () => {
        set({ activeSession: null });
      },

      drainSyncQueue: async () => {
        const { syncQueue } = get();
        if (syncQueue.length === 0) return;

        const remaining: WorkoutSession[] = [];
        for (const session of syncQueue) {
          try {
            await api.post("/api/workout/sessions", { session });
          } catch {
            remaining.push(session);
          }
        }
        set({ syncQueue: remaining });
      },
    }),
    {
      name: "workout-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist crash-sensitive state — loaded sessions come from the API
      partialize: (state) => ({
        activeSession: state.activeSession,
        syncQueue: state.syncQueue,
      }),
    },
  ),
);
