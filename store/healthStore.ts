import { create } from 'zustand';
import { NutritionEntry } from 'types/nutrition';
import { HealthEntry } from 'types/health';

type HealthState = {
  entries: HealthEntry[];
  food: NutritionEntry[];
  addEntry: (e: HealthEntry) => void;
  addFood: (f: NutritionEntry) => void;
};

export const useHealthStore = create<HealthState>((set) => ({
  entries: [],
  food: [],
  addEntry: (entry) => set((state) => ({ entries: [...state.entries, entry] })),

  addFood: (nutrition) => set((state) => ({ food: [...state.food, nutrition] })),
}));
