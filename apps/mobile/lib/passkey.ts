import { Platform } from 'react-native';
import { api } from './api';
import CredentialAuth from '@modules/credentials-auth';

// ============================================================================
// PASSKEY SUPPORT
// ============================================================================

export async function isPasskeySupported(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android') {
      return false;
    }

    if (!CredentialAuth) {
      console.error('CredentialAuth module not found');
      return false;
    }

    const result = await CredentialAuth.isPasskeyAvailable();
    return result?.available === true;
  } catch (error) {
    console.error('Error checking passkey support:', error);
    return false;
  }
}

// ============================================================================
// CREATE ACCOUNT WITH PASSKEY
// ============================================================================

export async function createPasskeyAccount(email: string): Promise<{
  success: boolean;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
}> {
  try {
    // 1. Get registration options from backend
    const options = await api.post('/auth/passkey/register/options', { email });

    // 2. Call native Credential Manager to create passkey
    const nativeResponse = await CredentialAuth.registerPasskey(JSON.stringify(options));

    // 3. Parse the native response
    const credential = JSON.parse(nativeResponse.credential);

    // 4. Verify with backend
    const response = await api.post('/auth/passkey/register/verify', {
      email,
      credential,
    });

    // Session is set via cookie by backend, but we also return tokens for memory hydration
    return {
      success: true,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    };
  } catch (error: any) {
    console.error('createPasskeyAccount error:', error);

    if (error.message?.includes('USER_CANCELLED')) {
      return { success: false, error: 'cancelled' };
    }

    return {
      success: false,
      error: error.message || 'Failed to create account',
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
    const options = await api.post('/auth/passkey/login/options', {});

    // 2. Call native Credential Manager
    // Ensure challengeId is passed if needed by native module?
    // Usually options contains everything.
    const nativeResponse = await CredentialAuth.authenticateWithPasskey(JSON.stringify(options));

    // 3. Parse the native response
    const credential = JSON.parse(nativeResponse.credential);

    // 4. Verify with backend
    const response = await api.post('/auth/passkey/login/verify', {
      credential,
      challengeId: options.challengeId,
    });

    // Session is set via cookie
    return {
      success: true,
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
    };
  } catch (error: any) {
    console.error('signInWithPasskey error:', error);

    if (error.message?.includes('USER_CANCELLED')) {
      return { success: false, error: 'cancelled' };
    }

    if (error.message?.includes('NO_CREDENTIAL')) {
      return { success: false, error: 'no_passkey' };
    }

    return { success: false, error: error.message || 'Authentication failed' };
  }
}
