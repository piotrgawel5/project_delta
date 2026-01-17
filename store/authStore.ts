// store/authStore.ts
import { create } from "zustand";
import { AuthError, Session, User } from "@supabase/supabase-js";
import { SESSION_CONFIG, supabase } from "@lib/supabase";
import { AppState, AppStateStatus } from "react-native";
import {
  createPasskeyAccount,
  isPasskeySupported,
  signInWithPasskey as passkeySignIn,
} from "@lib/passkey";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  passkeySupported: boolean;

  // Actions
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: AuthError | null }>;
  createAccountWithPasskey: (
    email: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signInWithPasskey: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  checkSession: () => Promise<void>;
  checkPasskeySupport: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,
  passkeySupported: false,

  initialize: async () => {
    try {
      const supported = await isPasskeySupported();
      set({ passkeySupported: supported });

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const isSessionValid = await validateSession(session);
        if (isSessionValid) {
          set({
            user: session.user,
            session,
            loading: false,
            initialized: true,
          });
        } else {
          await get().signOut();
        }
      } else {
        set({ user: null, session: null, loading: false, initialized: true });
      }

      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          set({ user: session.user, session });
        } else {
          set({ user: null, session: null });
        }
      });

      AppState.addEventListener("change", handleAppStateChange);
    } catch (error) {
      console.error("Auth initialization error:", error);
      set({ loading: false, initialized: true });
    }
  },

  checkPasskeySupport: async () => {
    const supported = await isPasskeySupported();
    set({ passkeySupported: supported });
  },

  checkSession: async () => {
    const { session } = get();
    if (!session) return;

    const shouldRefresh =
      new Date(session.expires_at! * 1000).getTime() - Date.now() <
        SESSION_CONFIG.REFRESH_THRESHOLD;

    if (shouldRefresh) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("Session refresh error:", error);
        await get().signOut();
      } else if (data.session) {
        set({ session: data.session, user: data.session.user });
      }
    }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true });

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      set({ loading: false });
      return { error };
    }

    if (data.session) {
      set({ user: data.user, session: data.session, loading: false });
    } else {
      set({ loading: false });
    }

    return { error: null };
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ loading: false });
      return { error };
    }

    set({ user: data.user, session: data.session, loading: false });
    return { error: null };
  },

  createAccountWithPasskey: async (email: string) => {
    set({ loading: true });

    try {
      const result = await createPasskeyAccount(email);

      if (!result.success) {
        set({ loading: false });
        return { success: false, error: result.error };
      }

      // Set session from tokens
      if (result.accessToken && result.refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        });

        if (sessionError) {
          console.error("Failed to set session:", sessionError);
          set({ loading: false });
          return { success: false, error: "Failed to establish session" };
        }

        // Explicitly set user and session in store
        if (data.session) {
          set({ user: data.session.user, session: data.session });
        }
      }

      set({ loading: false });
      return { success: true };
    } catch (error: any) {
      console.error("createAccountWithPasskey error:", error);
      set({ loading: false });
      return {
        success: false,
        error: error.message || "Failed to create account",
      };
    }
  },

  signInWithPasskey: async () => {
    set({ loading: true });

    try {
      const result = await passkeySignIn();

      if (!result.success) {
        set({ loading: false });
        return { success: false, error: result.error };
      }

      // Set session from tokens
      if (result.accessToken && result.refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        });

        if (sessionError) {
          console.error("Failed to set session:", sessionError);
          set({ loading: false });
          return { success: false, error: "Failed to establish session" };
        }

        // Explicitly set user and session in store
        if (data.session) {
          set({ user: data.session.user, session: data.session });
        }
      }

      set({ loading: false });
      return { success: true };
    } catch (error: any) {
      console.error("signInWithPasskey error:", error);
      set({ loading: false });
      return {
        success: false,
        error: error.message || "Authentication failed",
      };
    }
  },

  signOut: async () => {
    set({ loading: true });
    await supabase.auth.signOut();
    set({ user: null, session: null, loading: false });
  },
}));

// Helper functions
async function validateSession(session: Session): Promise<boolean> {
  const sessionAge = Date.now() - new Date(session.user.created_at).getTime();

  if (sessionAge > SESSION_CONFIG.MAX_SESSION_DURATION) {
    return false;
  }

  const expiresAt = session.expires_at! * 1000;
  if (expiresAt < Date.now()) {
    return false;
  }

  return true;
}

function handleAppStateChange(nextAppState: AppStateStatus) {
  if (nextAppState === "active") {
    useAuthStore.getState().checkSession();
  }
}
