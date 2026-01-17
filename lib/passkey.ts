import { Platform } from "react-native";
import { supabase } from "./supabase";
import CredentialAuth from "@modules/credentials-auth";

// ============================================================================
// PASSKEY SUPPORT
// ============================================================================

export async function isPasskeySupported(): Promise<boolean> {
  try {
    if (Platform.OS !== "android") {
      return false;
    }

    if (!CredentialAuth) {
      console.error("CredentialAuth module not found");
      return false;
    }

    const result = await CredentialAuth.isPasskeyAvailable();
    return result?.available === true;
  } catch (error) {
    console.error("Error checking passkey support:", error);
    return false;
  }
}

// ============================================================================
// CREATE ACCOUNT WITH PASSKEY
// ============================================================================

export async function createPasskeyAccount(
  email: string,
): Promise<
  {
    success: boolean;
    error?: string;
    accessToken?: string;
    refreshToken?: string;
  }
> {
  try {
    // 1. Get registration options from backend
    const { data: options, error: optionsError } = await supabase.functions
      .invoke(
        "passkey-register-options",
        { body: { email } },
      );

    if (optionsError || options?.error) {
      return {
        success: false,
        error: options?.error || optionsError?.message ||
          "Failed to get options",
      };
    }

    // 2. Call native Credential Manager to create passkey
    const nativeResponse = await CredentialAuth.registerPasskey(
      JSON.stringify(options),
    );

    // 3. Parse the native response
    const credential = JSON.parse(nativeResponse.credential);

    // 4. Verify with backend
    const { data: result, error: verifyError } = await supabase.functions
      .invoke(
        "passkey-register-verify",
        { body: { email, credential } },
      );

    if (verifyError || result?.error) {
      return {
        success: false,
        error: result?.error || verifyError?.message || "Verification failed",
      };
    }

    if (!result.verified) {
      return { success: false, error: "Passkey verification failed" };
    }

    return {
      success: true,
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
    };
  } catch (error: any) {
    console.error("createPasskeyAccount error:", error);

    if (error.message?.includes("USER_CANCELLED")) {
      return { success: false, error: "cancelled" };
    }

    return {
      success: false,
      error: error.message || "Failed to create account",
    };
  }
}

// ============================================================================
// SIGN IN WITH PASSKEY
// ============================================================================

export async function signInWithPasskey(): Promise<{
  success: boolean;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
}> {
  try {
    // 1. Get authentication options from backend
    const { data: options, error: optionsError } = await supabase.functions
      .invoke(
        "passkey-login-options",
        { body: {} },
      );

    if (optionsError || options?.error) {
      return {
        success: false,
        error: options?.error || optionsError?.message ||
          "Failed to get options",
      };
    }

    // 2. Call native Credential Manager
    const nativeResponse = await CredentialAuth.authenticateWithPasskey(
      JSON.stringify(options),
    );

    // 3. Parse the native response
    const credential = JSON.parse(nativeResponse.credential);

    // 4. Verify with backend
    const { data: result, error: verifyError } = await supabase.functions
      .invoke(
        "passkey-login-verify",
        { body: { credential, challengeId: options.challengeId } },
      );

    if (verifyError || result?.error) {
      return {
        success: false,
        error: result?.error || verifyError?.message || "Verification failed",
      };
    }

    if (!result.verified) {
      return { success: false, error: "Authentication failed" };
    }

    return {
      success: true,
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
    };
  } catch (error: any) {
    console.error("signInWithPasskey error:", error);

    if (error.message?.includes("USER_CANCELLED")) {
      return { success: false, error: "cancelled" };
    }

    if (error.message?.includes("NO_CREDENTIAL")) {
      return { success: false, error: "no_passkey" };
    }

    return { success: false, error: error.message || "Authentication failed" };
  }
}
