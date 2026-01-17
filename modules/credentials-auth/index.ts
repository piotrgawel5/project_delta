import { requireNativeModule } from "expo-modules-core";

const CredentialAuthModule = requireNativeModule("CredentialAuth");

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
    return CredentialAuthModule.signInWithGoogleAutoSelect(
      webClientId,
      autoSelect,
    );
  },

  async registerPasskey(requestJson: string): Promise<PasskeyCredentials> {
    return CredentialAuthModule.registerPasskey(requestJson);
  },

  async authenticateWithPasskey(
    requestJson: string,
  ): Promise<PasskeyCredentials> {
    return CredentialAuthModule.authenticateWithPasskey(requestJson);
  },

  async isPasskeyAvailable(): Promise<{ available: boolean }> {
    return CredentialAuthModule.isPasskeyAvailable();
  },
};

export default CredentialAuth;
