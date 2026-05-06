import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────────────────

const MealTypeSchema = z.enum(["breakfast", "lunch", "dinner", "snack"]);
const FoodSourceSchema = z.enum(["open_food_facts", "user", "verified"]);

const NutritionLogSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  date: z.string().date(),
  mealType: MealTypeSchema,
  foodId: z.string().uuid(),
  foodName: z.string().min(1).max(200),
  foodBrand: z.string().max(120).nullable(),
  grams: z.number().min(0).max(10000),
  kcal: z.number().min(0).max(20000),
  proteinG: z.number().min(0).max(2000),
  carbsG: z.number().min(0).max(2000),
  fatsG: z.number().min(0).max(2000),
  loggedAt: z.string().datetime(),
  source: FoodSourceSchema,
  createdAt: z.string().datetime().optional(),
});

const FoodSchema = z.object({
  id: z.string().uuid().optional(),
  source: FoodSourceSchema,
  barcode: z.string().min(4).max(32).nullable().optional(),
  name: z.string().min(1).max(200),
  brand: z.string().max(120).nullable().optional(),
  kcalPer100g: z.number().min(0).max(2000),
  proteinPer100g: z.number().min(0).max(200),
  carbsPer100g: z.number().min(0).max(200),
  fatsPer100g: z.number().min(0).max(200),
  locale: z.string().max(8).nullable().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Request schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/nutrition/logs/:userId?from&to
 */
export const nutritionLogsQuerySchema = z.object({
  params: z.object({
    userId: z.string().uuid(),
  }),
  query: z.object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  }),
});

/**
 * POST /api/nutrition/logs/sync
 * Body: { logs: NutritionLog[] } (idempotent batch upsert by id)
 */
export const nutritionLogsSyncSchema = z.object({
  body: z.object({
    logs: z.array(NutritionLogSchema).min(1).max(200),
  }),
});

/**
 * DELETE /api/nutrition/logs/:id
 */
export const nutritionLogDeleteSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

/**
 * GET /api/nutrition/foods/search?q&locale&limit
 */
export const nutritionFoodsSearchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(80),
    locale: z.string().max(8).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

/**
 * GET /api/nutrition/foods/barcode/:code
 */
export const nutritionFoodsBarcodeSchema = z.object({
  params: z.object({
    code: z.string().min(4).max(32),
  }),
});

/**
 * POST /api/nutrition/foods (user-defined food)
 */
export const nutritionFoodCreateSchema = z.object({
  body: z.object({
    food: FoodSchema,
  }),
});

export { NutritionLogSchema, FoodSchema };
