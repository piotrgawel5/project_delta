// Open Food Facts client (server-side).
// Free public API, EU-strong coverage. https://world.openfoodfacts.org/
//
// We never persist OFF responses verbatim — we project to the catalog shape
// and write through `nutrition.service.ts`. Coverage is best-effort: missing
// macros default to 0 and the row is skipped if name is empty.

import type { Food } from "../../types/nutrition";

const OFF_BASE = "https://world.openfoodfacts.org";
const OFF_TIMEOUT_MS = 4000;
const OFF_USER_AGENT = "ProjectDelta/0.1 (https://github.com/piotrgawel5)";

export type FoodCatalogRow = Omit<Food, "id" | "createdAt">;

interface OffNutriments {
  ["energy-kcal_100g"]?: number;
  ["energy_100g"]?: number;          // kJ fallback
  ["proteins_100g"]?: number;
  ["carbohydrates_100g"]?: number;
  ["fat_100g"]?: number;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  product_name_pl?: string;
  brands?: string;
  lang?: string;
  nutriments?: OffNutriments;
}

interface OffSearchResponse {
  products?: OffProduct[];
}

interface OffProductResponse {
  status?: number;       // 1 = found, 0 = not found
  product?: OffProduct;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": OFF_USER_AGENT, Accept: "application/json" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function pickName(p: OffProduct, locale?: string): string {
  if (locale === "pl" && p.product_name_pl) return p.product_name_pl;
  if (locale === "en" && p.product_name_en) return p.product_name_en;
  return p.product_name || p.product_name_en || p.product_name_pl || "";
}

function kcalFromNutriments(n: OffNutriments | undefined): number {
  if (!n) return 0;
  if (typeof n["energy-kcal_100g"] === "number") return n["energy-kcal_100g"];
  // Fallback: kJ → kcal (1 kcal ≈ 4.184 kJ).
  if (typeof n.energy_100g === "number") return n.energy_100g / 4.184;
  return 0;
}

function projectProduct(p: OffProduct, locale?: string): FoodCatalogRow | null {
  const name = pickName(p, locale).trim();
  if (!name) return null;
  const n = p.nutriments;
  return {
    source: "open_food_facts",
    barcode: p.code ?? null,
    name,
    brand: p.brands?.split(",")[0]?.trim() || null,
    kcalPer100g: round2(kcalFromNutriments(n)),
    proteinPer100g: round2(n?.["proteins_100g"] ?? 0),
    carbsPer100g: round2(n?.["carbohydrates_100g"] ?? 0),
    fatsPer100g: round2(n?.["fat_100g"] ?? 0),
    locale: locale ?? p.lang ?? null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface OpenFoodFactsClient {
  fetchByBarcode: (barcode: string, locale?: string) => Promise<FoodCatalogRow | null>;
  searchByName: (q: string, locale?: string, limit?: number) => Promise<FoodCatalogRow[]>;
}

export const openFoodFacts: OpenFoodFactsClient = {
  fetchByBarcode: async (barcode, locale) => {
    const url = `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=code,product_name,product_name_en,product_name_pl,brands,lang,nutriments`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return null;
    const data = (await resp.json()) as OffProductResponse;
    if (data.status !== 1 || !data.product) return null;
    return projectProduct(data.product, locale);
  },

  searchByName: async (q, locale, limit = 20) => {
    const params = new URLSearchParams({
      search_terms: q,
      page_size: String(Math.min(Math.max(limit, 1), 50)),
      fields: "code,product_name,product_name_en,product_name_pl,brands,lang,nutriments",
      json: "1",
    });
    if (locale) params.set("lc", locale);
    const url = `${OFF_BASE}/cgi/search.pl?${params.toString()}`;
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) return [];
    const data = (await resp.json()) as OffSearchResponse;
    const products = data.products ?? [];
    const rows: FoodCatalogRow[] = [];
    for (const p of products) {
      const projected = projectProduct(p, locale);
      if (projected) rows.push(projected);
    }
    return rows;
  },
};
