import { z } from "zod";

export const emailAuthSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
    }),
});

export const passkeyRegisterOptionsSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
    }),
});

export const passkeyVerifySchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address"),
        credential: z.object({
            id: z.string(),
            rawId: z.string().optional(),
            type: z.literal("public-key").optional(),
            response: z.object({
                clientDataJSON: z.string(),
                attestationObject: z.string(),
                transports: z.array(z.string()).optional(),
            }),
        }),
    }),
});

export const passkeyLoginVerifySchema = z.object({
    body: z.object({
        credential: z.object({
            id: z.string(),
            rawId: z.string().optional(),
            type: z.literal("public-key").optional(),
            response: z.object({
                clientDataJSON: z.string(),
                authenticatorData: z.string(),
                signature: z.string(),
                userHandle: z.string().optional(),
            }),
        }),
        challengeId: z.string().uuid("Invalid challenge ID"),
    }),
});

export const googleAuthSchema = z.object({
    body: z.object({
        idToken: z.string().min(1, "ID token is required"),
    }),
});

// Type exports
export type EmailAuth = z.infer<typeof emailAuthSchema>["body"];
export type PasskeyRegisterOptions = z.infer<
    typeof passkeyRegisterOptionsSchema
>["body"];
export type PasskeyVerify = z.infer<typeof passkeyVerifySchema>["body"];
export type PasskeyLoginVerify = z.infer<
    typeof passkeyLoginVerifySchema
>["body"];
export type GoogleAuth = z.infer<typeof googleAuthSchema>["body"];
