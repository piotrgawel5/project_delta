import { Request, Response } from "express";
import { profileService } from "./profile.service";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";

export class ProfileController {
    async getProfile(req: Request, res: Response) {
        const { userId } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized access to profile");
        }

        const data = await profileService.getProfile(userId);

        res.json({
            success: true,
            data,
        });
    }

    async updateProfile(req: Request, res: Response) {
        const { userId } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized to update profile");
        }

        const data = await profileService.updateProfile(userId, req.body);

        logger.info("Profile updated", {
            requestId: req.requestId,
            userId,
        });

        res.json({
            success: true,
            data,
        });
    }

    async uploadAvatar(req: Request, res: Response) {
        const { userId } = req.params;
        const { imageBase64, mimeType } = req.body;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized to upload avatar");
        }

        const buffer = Buffer.from(imageBase64, "base64");

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (buffer.length > maxSize) {
            throw AppError.badRequest(
                "Image size must be less than 5MB",
                "FILE_TOO_LARGE",
            );
        }

        const avatarUrl = await profileService.uploadAvatar(
            userId,
            buffer,
            mimeType,
        );

        logger.info("Avatar uploaded", {
            requestId: req.requestId,
            userId,
        });

        res.json({
            success: true,
            data: {
                avatarUrl,
            },
        });
    }

    async deleteAvatar(req: Request, res: Response) {
        const { userId } = req.params;
        const requester = (req as any).user;

        if (requester.id !== userId) {
            throw AppError.forbidden("Unauthorized to delete avatar");
        }

        await profileService.deleteAvatar(userId);

        logger.info("Avatar deleted", {
            requestId: req.requestId,
            userId,
        });

        res.json({
            success: true,
            message: "Avatar deleted successfully",
        });
    }
}

export const profileController = new ProfileController();
