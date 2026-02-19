import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import {
    generateAuthenticationOptions,
    generateRegistrationOptions,
    verifyAuthenticationResponse,
    verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
    AuthenticationResponseJSON,
    AuthenticatorDevice,
    RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { config } from "../../config";
import crypto from "crypto";

const { rpId: RP_ID, rpName: RP_NAME, rpOrigin: RP_ORIGIN } = config.passkey;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

type PasskeyChallengeRow = {
    id: string;
    challenge: string;
    created_at: string;
    email?: string | null;
    user_id?: string | null;
};

type PasskeyCredentialRow = {
    id: string;
    user_id: string;
    credential_id: string;
    public_key: {
        credentialPublicKey?: string;
        credentialID?: string;
        credentialDeviceType?: string;
        credentialBackedUp?: boolean;
        aaguid?: string;
    } | null;
    counter: number | null;
    transports: string[] | null;
};

const base64URLEncode = (buffer: Buffer | Uint8Array): string => {
    return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(
        /\//g,
        "_",
    ).replace(/=/g, "");
};

const base64URLDecode = (str: string): Buffer => {
    const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
        base64.length + (4 - (base64.length % 4)) % 4,
        "=",
    );
    return Buffer.from(padded, "base64");
};

export class AuthService {
    private supabaseAdmin: SupabaseClient;

    constructor() {
        this.supabaseAdmin = createClient(
            config.supabase.url,
            config.supabase.serviceRoleKey,
        );
    }

    private assertChallengeFresh(challenge: PasskeyChallengeRow) {
        const ageMs = Date.now() - new Date(challenge.created_at).getTime();
        if (ageMs > CHALLENGE_TTL_MS) {
            throw new Error("Challenge expired");
        }
    }

    private async consumeChallenge(id: string) {
        await this.supabaseAdmin.from("passkey_challenges").delete().eq("id", id);
    }

    private async findUserByEmail(email: string): Promise<User | null> {
        let page = 1;
        const perPage = 200;

        while (page <= 25) {
            const { data, error } = await this.supabaseAdmin.auth.admin
                .listUsers({ page, perPage });
            if (error) {
                throw new Error("Failed to lookup user");
            }

            const user = data.users.find((candidate) => candidate.email === email);
            if (user) {
                return user;
            }

            if (!data.nextPage) {
                break;
            }
            page = data.nextPage;
        }

        return null;
    }

    private async createSessionForEmail(email: string) {
        const { data: linkData, error: linkError } = await this.supabaseAdmin.auth
            .admin.generateLink({
                type: "magiclink",
                email,
            });

        if (linkError || !linkData.properties?.hashed_token) {
            throw new Error("Failed to create session");
        }

        const supabaseAnon = createClient(
            config.supabase.url,
            config.supabase.anonKey,
        );
        const verifyType = linkData.properties.verification_type === "magiclink"
            ? "magiclink"
            : "email";
        const { data: otpData, error: otpError } = await supabaseAnon.auth
            .verifyOtp({
                email,
                token_hash: linkData.properties.hashed_token,
                type: verifyType,
            });

        if (otpError || !otpData.session) {
            throw new Error("Failed to create session");
        }

        return otpData.session;
    }

    // --- Passkey Registration ---
    async getRegistrationOptions(email: string) {
        if (!email) throw new Error("Email is required");

        const options = await generateRegistrationOptions({
            rpName: RP_NAME,
            rpID: RP_ID,
            userName: email,
            userID: base64URLEncode(Buffer.from(crypto.randomUUID())),
            userDisplayName: email.split("@")[0],
            timeout: 60000,
            attestationType: "none",
            supportedAlgorithmIDs: [-7, -257],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                residentKey: "required",
                userVerification: "preferred",
            },
            excludeCredentials: [],
        });

        const { error } = await this.supabaseAdmin
            .from("passkey_challenges")
            .insert({
                challenge: options.challenge,
                email,
            });

        if (error) {
            throw new Error("Failed to create challenge: " + error.message);
        }

        return options;
    }

    async verifyRegistration(email: string, credential: RegistrationResponseJSON) {
        const { data: challengeRecord, error: challengeError } = await this
            .supabaseAdmin
            .from("passkey_challenges")
            .select("*")
            .eq("email", email)
            .order("created_at", { ascending: false })
            .limit(1)
            .single<PasskeyChallengeRow>();

        if (challengeError || !challengeRecord) {
            throw new Error("Challenge not found or expired");
        }
        this.assertChallengeFresh(challengeRecord);

        const verification = await verifyRegistrationResponse({
            response: credential,
            expectedChallenge: challengeRecord.challenge,
            expectedOrigin: RP_ORIGIN,
            expectedRPID: RP_ID,
            requireUserVerification: true,
        });

        if (!verification.verified || !verification.registrationInfo) {
            throw new Error("Passkey registration verification failed");
        }

        const { data: existingCredential, error: existingCredentialError } = await this
            .supabaseAdmin
            .from("passkey_credentials")
            .select("id")
            .eq("credential_id", credential.id)
            .maybeSingle<{ id: string }>();

        if (existingCredentialError) {
            throw new Error("Failed to check existing credentials");
        }
        if (existingCredential) {
            throw new Error("Passkey already registered");
        }

        let user: User | null = null;
        const { data: created, error: createError } = await this.supabaseAdmin.auth
            .admin.createUser({
                email,
                email_confirm: true,
                password: crypto.randomUUID(),
            });

        if (created.user) {
            user = created.user;
        } else if (
            createError?.message?.toLowerCase().includes("already") ||
            createError?.message?.toLowerCase().includes("exists")
        ) {
            user = await this.findUserByEmail(email);
        } else {
            throw new Error(createError?.message || "Failed to create user");
        }

        if (!user) {
            throw new Error("Failed to resolve user");
        }

        const registrationInfo = verification.registrationInfo;
        const credentialIdB64 = base64URLEncode(registrationInfo.credentialID);
        const credentialPublicKeyB64 = base64URLEncode(
            registrationInfo.credentialPublicKey,
        );
        const transports = credential.response.transports || ["internal"];

        const { error: insertError } = await this.supabaseAdmin
            .from("passkey_credentials")
            .insert({
                user_id: user.id,
                external_id: user.id,
                credential_id: credentialIdB64,
                public_key: {
                    credentialID: credentialIdB64,
                    credentialPublicKey: credentialPublicKeyB64,
                    credentialDeviceType: registrationInfo.credentialDeviceType,
                    credentialBackedUp: registrationInfo.credentialBackedUp,
                    aaguid: registrationInfo.aaguid,
                },
                counter: registrationInfo.counter,
                transports,
            });

        if (insertError) {
            throw new Error("Failed to store credential: " + insertError.message);
        }

        await this.consumeChallenge(challengeRecord.id);

        const session = await this.createSessionForEmail(email);
        return { session, user_id: user.id };
    }

    // --- Passkey Login ---
    async getLoginOptions() {
        const options = await generateAuthenticationOptions({
            rpID: RP_ID,
            userVerification: "preferred",
            timeout: 60000,
        });

        const { data: challengeRecord, error } = await this.supabaseAdmin
            .from("passkey_challenges")
            .insert({ challenge: options.challenge })
            .select("id")
            .single<{ id: string }>();

        if (error) throw new Error("Failed to create challenge");

        return {
            ...options,
            challengeId: challengeRecord.id,
        };
    }

    async verifyLogin(credential: AuthenticationResponseJSON, challengeId: string) {
        const { data: challengeRecord, error: challengeError } = await this
            .supabaseAdmin
            .from("passkey_challenges")
            .select("*")
            .eq("id", challengeId)
            .single<PasskeyChallengeRow>();

        if (challengeError || !challengeRecord) {
            throw new Error("Challenge not found or expired");
        }
        this.assertChallengeFresh(challengeRecord);

        const { data: storedCredential, error: storedCredentialError } = await this
            .supabaseAdmin
            .from("passkey_credentials")
            .select("*")
            .eq("credential_id", credential.id)
            .single<PasskeyCredentialRow>();

        if (storedCredentialError || !storedCredential) {
            throw new Error("Passkey not found");
        }

        const credentialPublicKey =
            storedCredential.public_key?.credentialPublicKey;
        if (!credentialPublicKey) {
            throw new Error("Stored passkey is invalid and must be re-registered");
        }

        const authenticator: AuthenticatorDevice = {
            credentialID: base64URLDecode(storedCredential.credential_id),
            credentialPublicKey: base64URLDecode(credentialPublicKey),
            counter: Number(storedCredential.counter || 0),
            transports: Array.isArray(storedCredential.transports)
                ? storedCredential.transports as AuthenticatorDevice["transports"]
                : undefined,
        };

        const verification = await verifyAuthenticationResponse({
            response: credential,
            expectedChallenge: challengeRecord.challenge,
            expectedOrigin: RP_ORIGIN,
            expectedRPID: RP_ID,
            authenticator,
            requireUserVerification: true,
        });

        if (!verification.verified || !verification.authenticationInfo) {
            throw new Error("Passkey authentication verification failed");
        }

        await this.supabaseAdmin
            .from("passkey_credentials")
            .update({ counter: verification.authenticationInfo.newCounter })
            .eq("id", storedCredential.id);

        await this.consumeChallenge(challengeId);

        const { data: userData, error: userError } = await this.supabaseAdmin.auth
            .admin.getUserById(storedCredential.user_id);
        if (userError || !userData.user?.email) {
            throw new Error("User not found");
        }

        const session = await this.createSessionForEmail(userData.user.email);
        return {
            session,
            user_id: storedCredential.user_id,
        };
    }

    // --- Email/Password ---
    async signInWithPassword(email: string, password: string) {
        const supabaseAnon = createClient(
            config.supabase.url,
            config.supabase.anonKey,
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
            config.supabase.url,
            config.supabase.anonKey,
        );
        const { data, error } = await supabaseAnon.auth.signUp({
            email,
            password,
        });
        if (error) throw error;
        return data.session;
    }

    async signInWithIdToken(token: string) {
        const supabaseAnon = createClient(
            config.supabase.url,
            config.supabase.anonKey,
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
            config.supabase.url,
            config.supabase.serviceRoleKey,
        );
        const { error } = await supabase.auth.admin.signOut(token);
        return !error;
    }

    async deleteUserAccount(userId: string) {
        const { error } = await this.supabaseAdmin.auth.admin.deleteUser(userId);
        if (error) {
            throw new Error("Failed to delete account");
        }
        return true;
    }
}

export const authService = new AuthService();
