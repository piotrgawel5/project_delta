import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { api } from '@lib/api';
import type { Food, MealType, NutritionLog } from '@shared';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error';

/** Input shape for `logFood` — store fills id/loggedAt/createdAt and computes macros. */
export interface LogFoodInput {
  userId: string;
  date: string;        // YYYY-MM-DD
  mealType: MealType;
  food: Food;
  grams: number;
}

interface NutritionStore {
  // Loaded server-side history (logs keyed by YYYY-MM-DD).
  logsByDate: Record<string, NutritionLog[]>;
  isLoaded: boolean;
  loadedForUserId: string | null;
  error: string | null;

  // Offline write queue — persisted via AsyncStorage.
  syncQueue: NutritionLog[];

  // Sync observability.
  syncStatus: SyncStatus;
  lastSyncError: string | null;

  // Actions
  fetchLogs: (userId: string, fromDate?: string, toDate?: string) => Promise<void>;
  logFood: (input: LogFoodInput) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
  searchFoods: (q: string, locale?: string) => Promise<Food[]>;
  lookupBarcode: (code: string) => Promise<Food | null>;
  drainSyncQueue: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function macrosForServing(food: Food, grams: number) {
  const factor = grams / 100;
  return {
    kcal: round2(food.kcalPer100g * factor),
    proteinG: round2(food.proteinPer100g * factor),
    carbsG: round2(food.carbsPer100g * factor),
    fatsG: round2(food.fatsPer100g * factor),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function bucketByDate(logs: NutritionLog[]): Record<string, NutritionLog[]> {
  const out: Record<string, NutritionLog[]> = {};
  for (const log of logs) {
    if (!out[log.date]) out[log.date] = [];
    out[log.date].push(log);
  }
  // Order each bucket by loggedAt ascending so meal lists read in chronological order.
  for (const date of Object.keys(out)) {
    out[date].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useNutritionStore = create<NutritionStore>()(
  persist(
    (set, get) => ({
      logsByDate: {},
      isLoaded: false,
      loadedForUserId: null,
      error: null,
      syncQueue: [],
      syncStatus: 'idle',
      lastSyncError: null,

      fetchLogs: async (userId, fromDate, toDate) => {
        const state = get();
        // Cache guard — refetch only when user changes or first load.
        if (state.isLoaded && state.loadedForUserId === userId && !fromDate && !toDate) {
          return;
        }
        if (state.loadedForUserId !== userId) {
          set({ logsByDate: {}, isLoaded: false, loadedForUserId: null });
        }

        try {
          const params: Record<string, string> = {};
          if (fromDate) params.from = fromDate;
          if (toDate) params.to = toDate;
          const resp = await api.get(`/api/nutrition/logs/${userId}`, { params });
          const logs = (resp.data ?? []) as NutritionLog[];
          set({
            logsByDate: bucketByDate(logs),
            isLoaded: true,
            loadedForUserId: userId,
            error: null,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to load logs',
            isLoaded: false,
          });
        }
      },

      logFood: async (input) => {
        const macros = macrosForServing(input.food, input.grams);
        const now = new Date().toISOString();

        const log: NutritionLog = {
          id: randomUUID(),
          userId: input.userId,
          date: input.date,
          mealType: input.mealType,
          foodId: input.food.id,
          foodName: input.food.name,
          foodBrand: input.food.brand,
          grams: input.grams,
          kcal: macros.kcal,
          proteinG: macros.proteinG,
          carbsG: macros.carbsG,
          fatsG: macros.fatsG,
          loggedAt: now,
          source: input.food.source,
          createdAt: now,
        };

        // Optimistic insert.
        const existing = get().logsByDate[input.date] ?? [];
        set({
          logsByDate: {
            ...get().logsByDate,
            [input.date]: [...existing, log].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
          },
          syncQueue: [...get().syncQueue, log],
        });

        await get().drainSyncQueue();
      },

      removeLog: async (id) => {
        // Optimistic local removal.
        const next: Record<string, NutritionLog[]> = {};
        for (const [date, logs] of Object.entries(get().logsByDate)) {
          next[date] = logs.filter((l) => l.id !== id);
        }
        set({
          logsByDate: next,
          // Drop from sync queue if it never reached the server.
          syncQueue: get().syncQueue.filter((l) => l.id !== id),
        });

        try {
          await api.delete(`/api/nutrition/logs/${id}`);
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to delete log',
          });
        }
      },

      searchFoods: async (q, locale) => {
        if (!q.trim()) return [];
        try {
          const params: Record<string, string> = { q };
          if (locale) params.locale = locale;
          const resp = await api.get(`/api/nutrition/foods/search`, { params });
          return (resp.data ?? []) as Food[];
        } catch {
          return [];
        }
      },

      lookupBarcode: async (code) => {
        try {
          const resp = await api.get(`/api/nutrition/foods/barcode/${code}`);
          return (resp.data ?? null) as Food | null;
        } catch {
          return null;
        }
      },

      drainSyncQueue: async () => {
        const { syncQueue } = get();
        if (syncQueue.length === 0) {
          set({ syncStatus: 'idle', lastSyncError: null });
          return;
        }

        set({ syncStatus: 'syncing', lastSyncError: null });

        try {
          await api.post('/api/nutrition/logs/sync', { logs: syncQueue });
          set({ syncQueue: [], syncStatus: 'idle', lastSyncError: null });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Network error';
          set({ syncStatus: 'error', lastSyncError: msg });
        }
      },
    }),
    {
      name: 'nutrition-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist the queue and today's optimistic logs only — server is the truth for history.
      partialize: (state) => ({ syncQueue: state.syncQueue }),
    },
  ),
);

// ─────────────────────────────────────────────────────────────────────────────
// Selectors (granular per CLAUDE.md)
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY_LOGS: NutritionLog[] = [];

export const selectLogsForDate = (date: string) => (s: NutritionStore) =>
  s.logsByDate[date] ?? EMPTY_LOGS;

// Pure helper — call inside a useMemo over the logs array. Do NOT use as a
// zustand selector: returning a fresh object every call breaks v5's
// useSyncExternalStore equality check and triggers an infinite render loop.
export function computeMacrosForLogs(logs: readonly NutritionLog[]) {
  return logs.reduce(
    (acc, l) => ({
      calories: acc.calories + l.kcal,
      protein: acc.protein + l.proteinG,
      carbs: acc.carbs + l.carbsG,
      fats: acc.fats + l.fatsG,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}
