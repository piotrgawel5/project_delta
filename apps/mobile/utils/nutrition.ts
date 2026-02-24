import { NutritionEntry } from '@shared';

export function getTodaysMacros(food: NutritionEntry[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return food
    .filter((f) => f.timestamp >= start.getTime())
    .reduce(
      (acc, f) => ({
        calories: acc.calories + f.macros.calories,
        protein: acc.protein + f.macros.protein,
        carbs: acc.carbs + f.macros.carbs,
        fats: acc.fats + f.macros.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
}
