import { create } from "zustand";
import { api } from "@lib/api";
import type { WorkoutExerciseLog, WorkoutSession, WorkoutSet } from "@shared";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface WorkoutStore {
  // Persisted session history (loaded from API)
  sessions: WorkoutSession[];
  isLoaded: boolean;
  error: string | null;

  // In-progress session (live tracking)
  activeSession: WorkoutSession | null;

  // Actions
  fetchSessions: (userId: string) => Promise<void>;
  startWorkout: (userId: string) => void;
  addExercise: (exerciseId: string) => void;
  logSet: (exerciseId: string, set: Omit<WorkoutSet, "id" | "completedAt">) => void;
  updateSet: (exerciseId: string, setId: string, updates: Partial<WorkoutSet>) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  removeExercise: (exerciseId: string) => void;
  finishWorkout: () => Promise<void>;
  discardWorkout: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useWorkoutStore = create<WorkoutStore>((set, get) => ({
  sessions: [],
  isLoaded: false,
  error: null,
  activeSession: null,

  fetchSessions: async (userId: string) => {
    // TODO: implement when backend is live
    // GET /api/workout/sessions/:userId?from=YYYY-MM-DD&to=YYYY-MM-DD
    void userId;
    void api;
    set({ isLoaded: true });
  },

  startWorkout: (userId: string) => {
    const now = new Date().toISOString();
    const session: WorkoutSession = {
      id: generateId(),
      userId,
      date: now.substring(0, 10),
      startedAt: now,
      finishedAt: null,
      durationSeconds: null,
      exercises: [],
      notes: null,
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
      id: generateId(),
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

  finishWorkout: async () => {
    const { activeSession, sessions } = get();
    if (!activeSession) return;

    const finishedAt = new Date().toISOString();
    const startMs = new Date(activeSession.startedAt).getTime();
    const finishMs = new Date(finishedAt).getTime();
    const durationSeconds = Math.floor((finishMs - startMs) / 1000);

    const finishedSession: WorkoutSession = {
      ...activeSession,
      finishedAt,
      durationSeconds,
    };

    // Optimistic update — persist locally immediately
    set({
      sessions: [finishedSession, ...sessions],
      activeSession: null,
    });

    // TODO: sync to backend when live
    // await api.post('/api/workout/sessions', { session: finishedSession });
  },

  discardWorkout: () => {
    set({ activeSession: null });
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
