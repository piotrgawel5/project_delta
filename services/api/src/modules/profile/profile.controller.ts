import { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { logger } from "../../utils/logger";

export class ProfileController {
    private supabase = createClient(
        config.supabase.url!,
        config.supabase.serviceRoleKey!,
    );

    async getProfile(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const requester = (req as any).user;

            if (requester.id !== userId) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            const { data, error } = await this.supabase
                .from("user_profiles")
                .select("*")
                .eq("user_id", userId)
                .single();

            if (error && error.code !== "PGRST116") throw error;

            // If not found, return null or empty object, consistent with store expectation
            res.json(data || null);
        } catch (error: any) {
            logger.error("getProfile error", error);
            res.status(500).json({ error: error.message });
        }
    }

    async updateProfile(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const requester = (req as any).user;

            if (requester.id !== userId) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            const { data, error } = await this.supabase
                .from("user_profiles")
                .upsert(
                    { ...req.body, user_id: userId },
                    { onConflict: "user_id" },
                )
                .select()
                .single();

            if (error) throw error;
            res.json(data);
        } catch (error: any) {
            logger.error("updateProfile error", error);
            res.status(500).json({ error: error.message });
        }
    }

    async uploadAvatar(req: Request, res: Response) {
        try {
            const { userId } = req.params;
            const { imageBase64, mimeType } = req.body;
            const requester = (req as any).user;

            if (requester.id !== userId) {
                return res.status(403).json({ error: "Unauthorized" });
            }

            const buffer = Buffer.from(imageBase64, "base64");
            const fileExt = mimeType === "image/png" ? "png" : "jpg";
            const fileName = `${userId}/avatar_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await this.supabase.storage
                .from("avatars")
                .upload(fileName, buffer, {
                    contentType: mimeType,
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = this.supabase.storage
                .from("avatars")
                .getPublicUrl(fileName);

            // Update profile
            await this.supabase
                .from("user_profiles")
                .update({ avatar_url: publicUrl })
                .eq("user_id", userId);

            res.json({ success: true, avatarUrl: publicUrl });
        } catch (error: any) {
            logger.error("uploadAvatar error", error);
            res.status(500).json({ error: error.message });
        }
    }
}

export const profileController = new ProfileController();
