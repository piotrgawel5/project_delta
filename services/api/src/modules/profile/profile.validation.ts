import { z } from "zod";

export const updateProfileSchema = z.object({
    body: z.object({
        display_name: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
        birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        gender: z.enum(["male", "female", "other", "prefer_not_to_say"])
            .optional(),
        height_cm: z.number().int().min(50).max(300).optional(),
        weight_kg: z.number().min(20).max(500).optional(),
        timezone: z.string().max(50).optional(),
        sleep_goal_hours: z.number().min(1).max(24).optional(),
        notification_preferences: z.object({
            sleep_reminder: z.boolean().optional(),
            weekly_report: z.boolean().optional(),
            tips: z.boolean().optional(),
        }).optional(),
        has_passkey: z.boolean().optional(),
        auth_method: z.enum(["password", "google", "apple", "passkey"])
            .optional(),
    }),
});

export const uploadAvatarSchema = z.object({
    body: z.object({
        imageBase64: z.string().min(1, "Image data is required"),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"], {
            errorMap: () => ({
                message: "Invalid image type. Supported: jpeg, png, webp",
            }),
        }),
    }),
});

export const profileParamsSchema = z.object({
    params: z.object({
        userId: z.string().uuid(),
    }),
});

export type UpdateProfile = z.infer<typeof updateProfileSchema>["body"];
export type UploadAvatar = z.infer<typeof uploadAvatarSchema>["body"];
