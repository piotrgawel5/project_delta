import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { logger } from "../../utils/logger";

export class SleepController {
    private supabase = createClient(
        config.supabase.url!,
        config.supabase.serviceRoleKey!,
    );

    async getHistory(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const requester = (req as any).user;

            if (requester.id !== userId) {
                return res.status(403).json({
                    error: "Unauthorized access to sleep data",
                });
            }

            const { data, error } = await this.supabase
                .from("sleep_logs")
                .select("*")
                .eq("user_id", userId)
                .order("date", { ascending: false })
                .limit(30);

            if (error) throw error;
            res.json(data);
        } catch (error: any) {
            logger.error("getSleepHistory error", error);
            res.status(500).json({ error: error.message });
        }
    }

    async saveLog(req: Request, res: Response) {
        try {
            const { user_id } = req.body;
            const requester = (req as any).user;

            if (requester.id !== user_id) {
                return res.status(403).json({
                    error: "Unauthorized to save sleep log",
                });
            }

            const { data, error } = await this.supabase
                .from("sleep_logs")
                .upsert(req.body)
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error: any) {
            logger.error("saveSleepLog error", error);
            res.status(500).json({ error: error.message });
        }
    }
}

export const sleepController = new SleepController();
