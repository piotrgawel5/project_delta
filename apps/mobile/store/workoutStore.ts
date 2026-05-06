import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { api } from "@lib/api";
import type { Equipment, WorkoutExerciseLog, WorkoutSession, WorkoutSet } from "@shared";

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

export interface SessionMetadata {
  name: string | null;
  feelRating: number | null;
  difficultyRating: number | null;
  notes: string | null;
}

export type SyncStatus = "idle" | "syncing" | "error";

export type LoggingMode = "quick" | "detailed";

interface WorkoutStore {
  // Persisted session history (loaded from API)
  sessions: WorkoutSession[];
  isLoaded: boolean;
  loadedForUserId: string | null;
  error: string | null;

  // In-progress session (live tracking) — persisted to AsyncStorage
  activeSession: ActiveWorkoutSession | null;

  // Finished sessions waiting to reach the server — persisted to AsyncStorage
  syncQueue: WorkoutSession[];

  // Sync observability
  syncStatus: SyncStatus;
  lastSyncError: string | null;

  // Logging UX preference — quick = one-tap "repeat / +2.5kg / skip"
  loggingMode: LoggingMode;
  setLoggingMode: (mode: LoggingMode) => void;

  // Equipment available to the user. Empty array = no preference (show all).
  availableEquipment: Equipment[];
  setAvailableEquipment: (next: Equipment[]) => void;

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
  finishWorkout: (metadata?: SessionMetadata) => Promise<void>;
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
      loadedForUserId: null,
      error: null,
      activeSession: null,
      syncQueue: [],
      syncStatus: "idle",
      lastSyncError: null,
      loggingMode: "quick",
      availableEquipment: [],

      setLoggingMode: (mode) => set({ loggingMode: mode }),
      setAvailableEquipment: (next) => set({ availableEquipment: next }),

      fetchSessions: async (userId: string) => {
        const state = get();
        if (state.isLoaded && state.loadedForUserId === userId) return;
        // Different user — clear stale sessions before fetching
        if (state.loadedForUserId !== userId) {
          set({ sessions: [], isLoaded: false, loadedForUserId: null });
        }
        try {
          const resp = await api.get(`/api/workout/sessions/${userId}`);
          set({ sessions: resp.data as WorkoutSession[], isLoaded: true, loadedForUserId: userId, error: null });
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
          name: null,
          feelRating: null,
          difficultyRating: null,
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

      finishWorkout: async (metadata?: SessionMetadata) => {
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

        // Drop exercises with no logged sets — backend stores nothing for them
        const cleanExercises = activeSession.exercises.filter((e) => e.sets.length > 0);

        const finishedSession: WorkoutSession = {
          id: activeSession.id,
          userId: activeSession.userId,
          date: activeSession.date,
          startedAt: activeSession.startedAt,
          finishedAt,
          durationSeconds,
          exercises: cleanExercises,
          notes: metadata?.notes ?? activeSession.notes ?? null,
          name: metadata?.name ?? null,
          feelRating: metadata?.feelRating ?? null,
          difficultyRating: metadata?.difficultyRating ?? null,
        };

        // Optimistic local history update; keep activeSession until sync settles
        // so the Active screen doesn't unmount while the finish sheet is animating.
        set({
          sessions: [finishedSession, ...sessions],
          syncQueue: [...syncQueue, finishedSession],
          syncStatus: "syncing",
          lastSyncError: null,
        });

        await get().drainSyncQueue();

        const { syncStatus, lastSyncError } = get();
        if (syncStatus === "error") {
          // Surface to caller so the finish sheet can stay open and show the error.
          throw new Error(lastSyncError ?? "Failed to sync workout");
        }

        // NOTE: do NOT clear activeSession here. The Active screen guards on
        // `if (!activeSession) return null` and would unmount mid-save, ripping
        // out the still-animating finish sheet. The screen calls
        // `discardWorkout()` itself once it has navigated back.
      },

      discardWorkout: () => {
        set({ activeSession: null });
      },

      drainSyncQueue: async () => {
        const { syncQueue } = get();
        if (syncQueue.length === 0) {
          set({ syncStatus: "idle", lastSyncError: null });
          return;
        }

        set({ syncStatus: "syncing", lastSyncError: null });

        const remaining: WorkoutSession[] = [];
        let lastError: string | null = null;

        try {
          for (const session of syncQueue) {
            try {
              await api.post("/api/workout/sessions", { session });
            } catch (err) {
              remaining.push(session);
              lastError = err instanceof Error ? err.message : "Network error";
            }
          }
        } finally {
          set({
            syncQueue: remaining,
            syncStatus: remaining.length === 0 ? "idle" : "error",
            lastSyncError: remaining.length === 0 ? null : lastError,
          });
        }
      },
    }),
    {
      name: "workout-store",
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist crash-sensitive state — loaded sessions come from the API
      partialize: (state) => ({
        activeSession: state.activeSession,
        syncQueue: state.syncQueue,
        loggingMode: state.loggingMode,
        availableEquipment: state.availableEquipment,
      }),
    },
  ),
);
