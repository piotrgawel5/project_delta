import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../../config";
import { logger } from "../../utils/logger";
import crypto from "crypto";

const RP_ID = process.env.PASSKEY_RP_ID || "piotrgawel5.github.io";
const RP_NAME = process.env.PASSKEY_RP_NAME || "Project Delta";

// Helper utilities
const base64URLEncode = (buffer: Buffer): string => {
    return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_")
        .replace(/=/g, "");
};

const base64URLDecode = (str: string): Buffer => {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
        base64.length + (4 - (base64.length % 4)) % 4,
        "=",
    );
    return Buffer.from(padded, "base64");
};

const generateChallenge = (): string => {
    return base64URLEncode(crypto.randomBytes(32));
};

export class AuthService {
    private supabaseAdmin: SupabaseClient;

    constructor() {
        this.supabaseAdmin = createClient(
            config.supabase.url!,
            config.supabase.serviceRoleKey!,
        );
    }

    // --- Passkey Registration ---

    async getRegistrationOptions(email: string) {
        if (!email) throw new Error("Email is required");

        // Check existing user
        const { data: existingUsers } = await this.supabaseAdmin.auth.admin
            .listUsers();
        const existingUser = existingUsers?.users.find((u) =>
            u.email === email
        );

        if (existingUser) {
            const { data: creds } = await this.supabaseAdmin
                .from("passkey_credentials")
                .select("credential_id")
                .eq("user_id", existingUser.id);

            if (creds && creds.length > 0) {
                throw new Error(
                    "Account already exists. Please sign in with your passkey.",
                );
            }
        }

        const challenge = generateChallenge();
        const userId = base64URLEncode(Buffer.from(crypto.randomUUID())); // Temp ID for WebAuthn

        const options = {
            challenge,
            rp: { name: RP_NAME, id: RP_ID },
            user: {
                id: userId,
                name: email,
                displayName: email.split("@")[0],
            },
            pubKeyCredParams: [
                { alg: -7, type: "public-key" }, // ES256
                { alg: -257, type: "public-key" }, // RS256
            ],
            timeout: 60000,
            attestation: "none",
            excludeCredentials: [],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                residentKey: "required",
                requireResidentKey: true,
                userVerification: "preferred",
            },
        };

        // Store challenge
        const { error } = await this.supabaseAdmin
            .from("passkey_challenges")
            .insert({
                challenge,
                email,
                user_id: existingUser?.id,
            });

        if (error) {
            throw new Error("Failed to create challenge: " + error.message);
        }

        return options;
    }

    async verifyRegistration(email: string, credential: any) {
        // Lookup challenge
        const { data: challengeRecord, error: challengeError } = await this
            .supabaseAdmin
            .from("passkey_challenges")
            .select("*")
            .eq("email", email)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (challengeError || !challengeRecord) {
            throw new Error("Challenge not found or expired");
        }

        // Verify challenge match
        const clientDataJSON = JSON.parse(
            base64URLDecode(credential.response.clientDataJSON).toString(
                "utf-8",
            ),
        );

        if (clientDataJSON.challenge !== challengeRecord.challenge) {
            throw new Error("Challenge mismatch");
        }

        // Create or get user
        let userId: string;
        let userPassword = crypto.randomUUID();

        const { data: existingUsers } = await this.supabaseAdmin.auth.admin
            .listUsers();
        const existingUser = existingUsers?.users.find((u) =>
            u.email === email
        );

        if (existingUser) {
            userId = existingUser.id;
            // Update password for sign-in
            await this.supabaseAdmin.auth.admin.updateUserById(userId, {
                password: userPassword,
            });
        } else {
            const { data: newUser, error: createError } = await this
                .supabaseAdmin.auth.admin.createUser({
                    email,
                    email_confirm: true,
                    password: userPassword,
                });
            if (createError || !newUser.user) {
                throw new Error(
                    createError?.message || "Failed to create user",
                );
            }
            userId = newUser.user.id;
        }

        // Store credential
        const credentialId = credential.id;
        const { data: existingCred } = await this.supabaseAdmin
            .from("passkey_credentials")
            .select("id")
            .eq("credential_id", credentialId)
            .single();

        if (!existingCred) {
            const { error: credError } = await this.supabaseAdmin
                .from("passkey_credentials")
                .insert({
                    user_id: userId,
                    credential_id: credentialId,
                    public_key: {
                        attestationObject:
                            credential.response.attestationObject,
                    }, // simplified
                    counter: 0,
                    transports: credential.response.transports || ["internal"],
                });
            if (credError) {
                throw new Error(
                    "Failed to store credential: " + credError.message,
                );
            }
        }

        // Cleanup challenge
        await this.supabaseAdmin.from("passkey_challenges").delete().eq(
            "id",
            challengeRecord.id,
        );

        // Sign in to get session
        const supabaseAnon = createClient(
            config.supabase.url!,
            process.env.SUPABASE_ANON_KEY || "",
        );
        const { data: signInData, error: signInError } = await supabaseAnon.auth
            .signInWithPassword({
                email,
                password: userPassword,
            });

        if (signInError || !signInData.session) {
            throw new Error("Failed to create session");
        }

        return { session: signInData.session, user_id: userId };
    }

    // --- Passkey Login ---

    async getLoginOptions() {
        const challenge = generateChallenge();

        const { data: challengeRecord, error } = await this.supabaseAdmin
            .from("passkey_challenges")
            .insert({ challenge })
            .select("id")
            .single();

        if (error) throw new Error("Failed to create challenge");

        return {
            challenge,
            rpId: RP_ID,
            timeout: 60000,
            userVerification: "preferred",
            allowCredentials: [],
            challengeId: challengeRecord.id,
        };
    }

    async verifyLogin(credential: any, challengeId: string) {
        const { data: challengeRecord, error: challengeError } = await this
            .supabaseAdmin
            .from("passkey_challenges")
            .select("*")
            .eq("id", challengeId)
            .single();

        if (challengeError || !challengeRecord) {
            throw new Error("Challenge not found or expired");
        }

        const clientDataJSON = JSON.parse(
            base64URLDecode(credential.response.clientDataJSON).toString(
                "utf-8",
            ),
        );

        if (clientDataJSON.challenge !== challengeRecord.challenge) {
            throw new Error("Challenge mismatch");
        }

        // Get credential
        const credentialId = credential.id;
        const { data: storedCredential, error: credError } = await this
            .supabaseAdmin
            .from("passkey_credentials")
            .select("*")
            .eq("credential_id", credentialId)
            .single();

        if (credError || !storedCredential) {
            throw new Error("Passkey not found");
        }

        // Update counter
        await this.supabaseAdmin
            .from("passkey_credentials")
            .update({ counter: (storedCredential.counter || 0) + 1 })
            .eq("id", storedCredential.id);

        // Cleanup challenge
        await this.supabaseAdmin.from("passkey_challenges").delete().eq(
            "id",
            challengeId,
        );

        // Get user email
        const { data: userData } = await this.supabaseAdmin.auth.admin
            .getUserById(storedCredential.user_id);
        const email = userData?.user?.email;
        if (!email) throw new Error("User not found");

        // Temp password login
        const tempPassword = crypto.randomUUID();
        await this.supabaseAdmin.auth.admin.updateUserById(
            storedCredential.user_id,
            { password: tempPassword },
        );

        const supabaseAnon = createClient(
            config.supabase.url!,
            process.env.SUPABASE_ANON_KEY || "",
        );
        const { data: signInData, error: signInError } = await supabaseAnon.auth
            .signInWithPassword({
                email,
                password: tempPassword,
            });

        if (signInError || !signInData.session) {
            throw new Error("Failed to create session");
        }

        return {
            session: signInData.session,
            user_id: storedCredential.user_id,
        };
    }

    // --- Email/Password ---

    async signInWithPassword(email: string, password: string) {
        const supabaseAnon = createClient(
            config.supabase.url!,
            process.env.SUPABASE_ANON_KEY || "",
        );
        const { data, error } = await supabaseAnon.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data.session;
    }

    async signUpWithPassword(email: string, password: string) {
        const supabaseAnon = createClient(
            config.supabase.url!,
            process.env.SUPABASE_ANON_KEY || "",
        );
        // Using signUp only creates request, might wait for email confirmation.
        // If auto-confirm is on, it returns session.
        const { data, error } = await supabaseAnon.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
        return data.session;
    }

    async signInWithIdToken(token: string) {
        const supabaseAnon = createClient(
            config.supabase.url!,
            process.env.SUPABASE_ANON_KEY || "",
        );
        const { data, error } = await supabaseAnon.auth.signInWithIdToken({
            provider: "google",
            token,
        });
        if (error) throw error;
        return data.session;
    }

    async signOut(token: string) {
        const supabase = createClient(
            config.supabase.url!,
            config.supabase.serviceRoleKey!,
        );
        // Admin signOut? Or user?
        // Supabase auth.signOut usually needs the client to have the session.
        // We can just act like we're done.
        // But better to invalidate if possible.
        const { error } = await supabase.auth.admin.signOut(token);
        return !error;
    }
}

export const authService = new AuthService();
