// Local nutrition types for the API service.
// Mirror of packages/shared/src/types/nutrition.ts — keep in sync.

export type FoodSource = 'open_food_facts' | 'user' | 'verified';

export interface Food {
  id: string;
  source: FoodSource;
  barcode: string | null;
  name: string;
  brand: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatsPer100g: number;
  locale: string | null;
  createdAt: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface NutritionLog {
  id: string;
  userId: string;
  date: string;
  mealType: MealType;
  foodId: string;
  foodName: string;
  foodBrand: string | null;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  loggedAt: string;
  source: FoodSource;
  createdAt: string;
}
