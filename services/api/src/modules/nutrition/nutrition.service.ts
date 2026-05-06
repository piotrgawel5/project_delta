import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { AppError } from "../../utils/AppError";
import type { Food, NutritionLog } from "../../types/nutrition";
import { openFoodFacts } from "./openFoodFacts";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase client (service role — bypasses RLS, ownership enforced in queries)
// ─────────────────────────────────────────────────────────────────────────────

function getClient(): SupabaseClient {
  return createClient(config.supabase.url!, config.supabase.serviceRoleKey!);
}

// ─────────────────────────────────────────────────────────────────────────────
// DB row shapes (snake_case)
// ─────────────────────────────────────────────────────────────────────────────

interface FoodRow {
  id: string;
  source: Food["source"];
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal_per_100g: number | string;
  protein_per_100g: number | string;
  carbs_per_100g: number | string;
  fats_per_100g: number | string;
  locale: string | null;
  created_at: string;
}

interface LogRow {
  id: string;
  user_id: string;
  date: string;
  meal_type: NutritionLog["mealType"];
  food_id: string;
  food_name: string;
  food_brand: string | null;
  grams: number | string;
  kcal: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fats_g: number | string;
  logged_at: string;
  source: NutritionLog["source"];
  created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers (DB rows → domain types). Numeric columns return as strings on some
// PostgREST configs; coerce defensively.
// ─────────────────────────────────────────────────────────────────────────────

const num = (v: number | string): number => (typeof v === "number" ? v : Number(v));

function mapFood(row: FoodRow): Food {
  return {
    id: row.id,
    source: row.source,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    kcalPer100g: num(row.kcal_per_100g),
    proteinPer100g: num(row.protein_per_100g),
    carbsPer100g: num(row.carbs_per_100g),
    fatsPer100g: num(row.fats_per_100g),
    locale: row.locale,
    createdAt: row.created_at,
  };
}

function mapLog(row: LogRow): NutritionLog {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    mealType: row.meal_type,
    foodId: row.food_id,
    foodName: row.food_name,
    foodBrand: row.food_brand,
    grams: num(row.grams),
    kcal: num(row.kcal),
    proteinG: num(row.protein_g),
    carbsG: num(row.carbs_g),
    fatsG: num(row.fats_g),
    loggedAt: row.logged_at,
    source: row.source,
    createdAt: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchLogs(
  userId: string,
  from?: string,
  to?: string,
): Promise<NutritionLog[]> {
  const supabase = getClient();

  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("nutrition_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("date", from ?? defaultFrom)
    .lte("date", to ?? today)
    .order("logged_at", { ascending: false });

  if (error) {
    throw AppError.internal(`Failed to fetch nutrition logs: ${error.message}`);
  }
  return ((data ?? []) as LogRow[]).map(mapLog);
}

// ─────────────────────────────────────────────────────────────────────────────
// Write — batch upsert, idempotent by id
// ─────────────────────────────────────────────────────────────────────────────

export async function syncLogs(logs: NutritionLog[], userId: string): Promise<void> {
  if (logs.length === 0) return;

  for (const log of logs) {
    if (log.userId !== userId) {
      throw AppError.forbidden("Cannot sync another user's logs");
    }
  }

  const supabase = getClient();

  const rows = logs.map((log) => ({
    id: log.id,
    user_id: log.userId,
    date: log.date,
    meal_type: log.mealType,
    food_id: log.foodId,
    food_name: log.foodName,
    food_brand: log.foodBrand,
    grams: log.grams,
    kcal: log.kcal,
    protein_g: log.proteinG,
    carbs_g: log.carbsG,
    fats_g: log.fatsG,
    logged_at: log.loggedAt,
    source: log.source,
  }));

  const { error } = await supabase
    .from("nutrition_logs")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw AppError.internal(`Failed to sync nutrition logs: ${error.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteLog(id: string, userId: string): Promise<void> {
  const supabase = getClient();

  const { data: log, error: fetchErr } = await supabase
    .from("nutrition_logs")
    .select("user_id")
    .eq("id", id)
    .single();

  if (fetchErr || !log) {
    throw AppError.notFound("Nutrition log not found");
  }
  if ((log as { user_id: string }).user_id !== userId) {
    throw AppError.forbidden("Cannot delete another user's log");
  }

  const { error: deleteErr } = await supabase
    .from("nutrition_logs")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    throw AppError.internal(`Failed to delete nutrition log: ${deleteErr.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Foods — search & barcode
// ─────────────────────────────────────────────────────────────────────────────

export async function searchFoods(
  q: string,
  locale?: string,
  limit = 20,
): Promise<Food[]> {
  const supabase = getClient();

  // 1. Local catalog first (trigram-indexed name search).
  const { data, error } = await supabase
    .from("foods")
    .select("*")
    .ilike("name", `%${q}%`)
    .limit(limit);

  if (error) {
    throw AppError.internal(`Failed to search foods: ${error.message}`);
  }
  const local = ((data ?? []) as FoodRow[]).map(mapFood);
  if (local.length >= limit) return local;

  // 2. Top up from Open Food Facts and persist as cache.
  try {
    const remote = await openFoodFacts.searchByName(q, locale, limit - local.length);
    const upserted = await upsertCatalogRows(supabase, remote);
    // Dedupe by id.
    const seen = new Set(local.map((f) => f.id));
    return [...local, ...upserted.filter((f) => !seen.has(f.id))].slice(0, limit);
  } catch {
    // OFF is best-effort; never break search on remote failure.
    return local;
  }
}

export async function lookupBarcode(code: string): Promise<Food | null> {
  const supabase = getClient();

  // Cache hit?
  const { data: cached } = await supabase
    .from("foods")
    .select("*")
    .eq("barcode", code)
    .maybeSingle();

  if (cached) return mapFood(cached as FoodRow);

  // Remote lookup.
  const remote = await openFoodFacts.fetchByBarcode(code);
  if (!remote) return null;

  const [persisted] = await upsertCatalogRows(supabase, [remote]);
  return persisted ?? null;
}

export async function createUserFood(
  food: Omit<Food, "id" | "createdAt">,
): Promise<Food> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from("foods")
    .insert({
      source: food.source,
      barcode: food.barcode,
      name: food.name,
      brand: food.brand,
      kcal_per_100g: food.kcalPer100g,
      protein_per_100g: food.proteinPer100g,
      carbs_per_100g: food.carbsPer100g,
      fats_per_100g: food.fatsPer100g,
      locale: food.locale,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw AppError.internal(`Failed to create food: ${error?.message ?? "no data"}`);
  }
  return mapFood(data as FoodRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal — catalog upsert
// ─────────────────────────────────────────────────────────────────────────────

async function upsertCatalogRows(
  supabase: SupabaseClient,
  rows: Omit<Food, "id" | "createdAt">[],
): Promise<Food[]> {
  if (rows.length === 0) return [];
  // Only barcode-bearing rows can be deduped server-side; for the rest, insert.
  const withBarcode = rows.filter((r) => r.barcode);
  const withoutBarcode = rows.filter((r) => !r.barcode);

  const out: Food[] = [];

  if (withBarcode.length > 0) {
    const payload = withBarcode.map(toFoodInsert);
    const { data, error } = await supabase
      .from("foods")
      .upsert(payload, { onConflict: "barcode" })
      .select("*");
    if (error) {
      throw AppError.internal(`Failed to upsert foods: ${error.message}`);
    }
    out.push(...((data ?? []) as FoodRow[]).map(mapFood));
  }

  if (withoutBarcode.length > 0) {
    const payload = withoutBarcode.map(toFoodInsert);
    const { data, error } = await supabase.from("foods").insert(payload).select("*");
    if (error) {
      throw AppError.internal(`Failed to insert foods: ${error.message}`);
    }
    out.push(...((data ?? []) as FoodRow[]).map(mapFood));
  }

  return out;
}

function toFoodInsert(food: Omit<Food, "id" | "createdAt">) {
  return {
    source: food.source,
    barcode: food.barcode,
    name: food.name,
    brand: food.brand,
    kcal_per_100g: food.kcalPer100g,
    protein_per_100g: food.proteinPer100g,
    carbs_per_100g: food.carbsPer100g,
    fats_per_100g: food.fatsPer100g,
    locale: food.locale,
  };
}
