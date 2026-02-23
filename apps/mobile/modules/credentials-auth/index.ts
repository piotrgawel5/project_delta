import { requireOptionalNativeModule } from "expo-modules-core";

const CredentialAuthModule = requireOptionalNativeModule("CredentialAuth");

export interface GoogleCredentials {
  idToken: string;
  id: string;
  email?: string;
  displayName?: string;
  givenName?: string;
  familyName?: string;
  profilePictureUri?: string;
  phoneNumber?: string;
}

export interface PasskeyCredentials {
  type: "public-key";
  credential: string; // JSON string from Android Credential Manager
}

export const CredentialAuth = {
  async signInWithGoogleAutoSelect(
    webClientId: string,
    autoSelect: boolean,
  ): Promise<GoogleCredentials> {
    if (!CredentialAuthModule) {
      throw new Error("CredentialAuth native module unavailable");
    }
    return CredentialAuthModule.signInWithGoogleAutoSelect(
      webClientId,
      autoSelect,
    );
  },

  async registerPasskey(requestJson: string): Promise<PasskeyCredentials> {
    if (!CredentialAuthModule) {
      throw new Error("CredentialAuth native module unavailable");
    }
    return CredentialAuthModule.registerPasskey(requestJson);
  },

  async authenticateWithPasskey(
    requestJson: string,
  ): Promise<PasskeyCredentials> {
    if (!CredentialAuthModule) {
      throw new Error("CredentialAuth native module unavailable");
    }
    return CredentialAuthModule.authenticateWithPasskey(requestJson);
  },

  async isPasskeyAvailable(): Promise<{ available: boolean }> {
    if (!CredentialAuthModule) {
      return { available: false };
    }
    return CredentialAuthModule.isPasskeyAvailable();
  },
};

export default CredentialAuth;
