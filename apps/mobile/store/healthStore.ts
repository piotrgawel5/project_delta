import { create } from 'zustand';
import type { NutritionEntry } from '@shared';

interface HealthState {
  food: NutritionEntry[];
  addFood: (entry: NutritionEntry) => void;
}

export const useHealthStore = create<HealthState>((set) => ({
  food: [],
  addFood: (entry) =>
    set((state) => ({
      food: [entry, ...state.food],
    })),
}));
