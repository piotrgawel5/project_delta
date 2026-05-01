import type { Request, Response } from "express";
import * as workoutService from "./workout.service";

export const workoutController = {
  /**
   * POST /api/workout/sessions
   * Sync a completed workout session.
   */
  syncSession: async (req: Request, res: Response): Promise<void> => {
    const { session } = req.body as { session: Parameters<typeof workoutService.saveSession>[0] };
    const userId = req.user!.id;
    await workoutService.saveSession(session, userId);
    res.status(201).json({ data: { id: session.id } });
  },

  /**
   * GET /api/workout/sessions/:userId
   * Fetch session history for a user.
   */
  getSessions: async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { from, to } = req.query as { from?: string; to?: string };
    const sessions = await workoutService.fetchSessions(userId, from, to);
    res.json({ data: sessions });
  },

  /**
   * DELETE /api/workout/sessions/:id
   * Delete a workout session.
   */
  deleteSession: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user!.id;
    await workoutService.deleteSession(id, userId);
    res.status(204).send();
  },
};
