import { z } from "zod";

export const emailAuthSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(6),
    }),
});

export const passkeyRegisterOptionsSchema = z.object({
    body: z.object({
        email: z.string().email(),
    }),
});

export const passkeyVerifySchema = z.object({
    body: z.object({
        email: z.string().email(),
        credential: z.any(),
    }),
});
