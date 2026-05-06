import { HealthCategory } from './health';

// ─────────────────────────────────────────────────────────────────────────────
// Macros
// ─────────────────────────────────────────────────────────────────────────────

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Food (catalog row)
// ─────────────────────────────────────────────────────────────────────────────

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
  createdAt: string; // ISO timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// Nutrition Log (a meal entry)
// ─────────────────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface NutritionLog {
  id: string;
  userId: string;
  date: string;     // YYYY-MM-DD
  mealType: MealType;
  foodId: string;
  foodName: string; // denormalized for offline display
  foodBrand: string | null;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  loggedAt: string; // ISO timestamp
  source: FoodSource;
  createdAt: string; // ISO timestamp
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy in-memory entry (used by deprecated features/food/* — pending removal)
// ─────────────────────────────────────────────────────────────────────────────

export type NutritionEntry = {
  id: string;
  category: HealthCategory; // always "nutrition"
  name: string;
  macros: Macros;
  timestamp: number;
};

// Zod schemas live in services/api/src/modules/nutrition/nutrition.validation.ts
// (mirror the workout module convention — shared has no zod dependency).
