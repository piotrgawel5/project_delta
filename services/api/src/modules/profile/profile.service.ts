import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { AppError } from "../../utils/AppError";
import { UpdateProfile } from "./profile.validation";

export class ProfileService {
    private supabase: SupabaseClient;

    constructor() {
        this.supabase = createClient(
            config.supabase.url!,
            config.supabase.serviceRoleKey!,
        );
    }

    async getProfile(userId: string) {
        const { data, error } = await this.supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error && error.code !== "PGRST116") {
            throw AppError.internal(
                `Failed to fetch profile: ${error.message}`,
            );
        }

        return data || null;
    }

    async updateProfile(userId: string, updates: UpdateProfile) {
        const { data, error } = await this.supabase
            .from("user_profiles")
            .upsert(
                { ...updates, user_id: userId },
                { onConflict: "user_id" },
            )
            .select()
            .single();

        if (error) {
            throw AppError.internal(
                `Failed to update profile: ${error.message}`,
            );
        }

        return data;
    }

    async uploadAvatar(
        userId: string,
        imageBuffer: Buffer,
        mimeType: string,
    ): Promise<string> {
        const fileExt = mimeType === "image/png"
            ? "png"
            : mimeType === "image/webp"
            ? "webp"
            : "jpg";
        const fileName = `${userId}/avatar_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await this.supabase.storage
            .from("avatars")
            .upload(fileName, imageBuffer, {
                contentType: mimeType,
                upsert: true,
            });

        if (uploadError) {
            throw AppError.internal(
                `Failed to upload avatar: ${uploadError.message}`,
            );
        }

        const { data: { publicUrl } } = this.supabase.storage
            .from("avatars")
            .getPublicUrl(fileName);

        // Update profile with new avatar URL
        await this.supabase
            .from("user_profiles")
            .update({ avatar_url: publicUrl })
            .eq("user_id", userId);

        return publicUrl;
    }

    async deleteAvatar(userId: string) {
        // List all files in user's avatar folder
        const { data: files, error: listError } = await this.supabase.storage
            .from("avatars")
            .list(userId);

        if (listError) {
            throw AppError.internal(
                `Failed to list avatars: ${listError.message}`,
            );
        }

        if (files && files.length > 0) {
            const filePaths = files.map((f) => `${userId}/${f.name}`);
            const { error: deleteError } = await this.supabase.storage
                .from("avatars")
                .remove(filePaths);

            if (deleteError) {
                throw AppError.internal(
                    `Failed to delete avatar: ${deleteError.message}`,
                );
            }
        }

        // Clear avatar URL from profile
        await this.supabase
            .from("user_profiles")
            .update({ avatar_url: null })
            .eq("user_id", userId);

        return true;
    }
}

export const profileService = new ProfileService();
