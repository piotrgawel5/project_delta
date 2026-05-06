import type { Request, Response } from "express";
import * as nutritionService from "./nutrition.service";
import type { Food, NutritionLog } from "../../types/nutrition";

export const nutritionController = {
  /**
   * GET /api/nutrition/logs/:userId?from&to
   */
  getLogs: async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };
    const logs = await nutritionService.fetchLogs(userId, from, to);
    res.json({ data: logs });
  },

  /**
   * POST /api/nutrition/logs/sync
   */
  syncLogs: async (req: Request, res: Response): Promise<void> => {
    const { logs } = req.body as { logs: NutritionLog[] };
    const userId = req.user!.id;
    await nutritionService.syncLogs(logs, userId);
    res.status(201).json({ data: { count: logs.length } });
  },

  /**
   * DELETE /api/nutrition/logs/:id
   */
  deleteLog: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;
    await nutritionService.deleteLog(id, userId);
    res.status(204).send();
  },

  /**
   * GET /api/nutrition/foods/search?q&locale&limit
   */
  searchFoods: async (req: Request, res: Response): Promise<void> => {
    const { q, locale, limit } = req.query as {
      q: string;
      locale?: string;
      limit?: string;
    };
    const foods = await nutritionService.searchFoods(
      q,
      locale,
      limit ? Number(limit) : undefined,
    );
    res.json({ data: foods });
  },

  /**
   * GET /api/nutrition/foods/barcode/:code
   */
  lookupBarcode: async (req: Request, res: Response): Promise<void> => {
    const { code } = req.params;
    const food = await nutritionService.lookupBarcode(code);
    if (!food) {
      res.status(404).json({ error: "Food not found for barcode" });
      return;
    }
    res.json({ data: food });
  },

  /**
   * POST /api/nutrition/foods
   */
  createFood: async (req: Request, res: Response): Promise<void> => {
    const { food } = req.body as { food: Omit<Food, "id" | "createdAt"> };
    const created = await nutritionService.createUserFood(food);
    res.status(201).json({ data: created });
  },
};
