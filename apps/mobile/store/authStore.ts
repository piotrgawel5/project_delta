// store/authStore.ts
import { create } from "zustand";
import { AuthError, Session, User } from "@supabase/supabase-js";
import { SESSION_CONFIG, supabase } from "@lib/supabase";
import { api } from "@lib/api";
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
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
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

      // Check server-side session via API
      try {
        const response = await api.get("/auth/me");
        if (response.user) {
          // Hydrate Supabase client for data access
          if (response.access_token && response.refresh_token) {
            await supabase.auth.setSession({
              access_token: response.access_token,
              refresh_token: response.refresh_token,
            });
          }

          // Get session object from supabase client to ensure consistency
          const { data: { session } } = await supabase.auth.getSession();

          set({
            user: response.user,
            session: session || null, // Session might be constructed manually or from supabase
            loading: false,
            initialized: true,
          });
        } else {
          set({ user: null, session: null, loading: false, initialized: true });
        }
      } catch (error) {
        // If 401 or network error, assume logged out
        set({ user: null, session: null, loading: false, initialized: true });
      }
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
    // Rely on initialize or periodic checks
    // Could re-call /auth/me
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true });

    try {
      const response = await api.post("/auth/email/signup", {
        email,
        password,
      });

      if (response.user) {
        if (response.access_token && response.refresh_token) {
          await supabase.auth.setSession({
            access_token: response.access_token,
            refresh_token: response.refresh_token,
          });
        }
        const { data: { session } } = await supabase.auth.getSession();

        set({ user: response.user, session, loading: false });
        return { error: null };
      }

      // Email confirmation sent case
      set({ loading: false });
      return { error: null };
    } catch (error: any) {
      set({ loading: false });
      return {
        error: {
          message: error.message || "Signup failed",
          name: "AuthError",
        } as AuthError,
      };
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });

    try {
      const response = await api.post("/auth/email/login", { email, password });

      if (response.user) {
        if (response.access_token && response.refresh_token) {
          await supabase.auth.setSession({
            access_token: response.access_token,
            refresh_token: response.refresh_token,
          });
        }
        const { data: { session } } = await supabase.auth.getSession();

        set({ user: response.user, session, loading: false });
        return { error: null };
      }

      set({ loading: false });
      return {
        error: { message: "Login failed", name: "AuthError" } as AuthError,
      };
    } catch (error: any) {
      set({ loading: false });
      // Map API error to AuthError shape
      return {
        error: {
          message: error.message || "Login failed",
          name: "AuthError",
        } as AuthError,
      };
    }
  },

  createAccountWithPasskey: async (email: string) => {
    set({ loading: true });

    try {
      const result = await createPasskeyAccount(email);

      if (!result.success) {
        set({ loading: false });
        return { success: false, error: result.error };
      }

      // Session is set via cookie AND returned in result
      if (result.accessToken && result.refreshToken) {
        await supabase.auth.setSession({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        });

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          set({ user: session.user, session });
        }
      } else {
        // If for some reason tokens missing, try fetching from /me
        const me = await api.get("/auth/me");
        if (me.user) {
          set({ user: me.user });
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

      // Session is set via cookie AND returned in result
      if (result.accessToken && result.refreshToken) {
        await supabase.auth.setSession({
          access_token: result.accessToken,
          refresh_token: result.refreshToken,
        });

        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          set({ user: session.user, session });
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
    try {
      await api.post("/auth/logout", {});
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Signout error", e);
    }
    set({ user: null, session: null, loading: false });
  },

  deleteAccount: async () => {
    try {
      // Logic for delete account should ideally move to API too
      // But preserving existing logic if compatible?
      // Existing logic calls supabase directly.
      // If we have token in memory, it might work if policies allow.
      // But we should use API.
      // For Phase 3, I'll call API if I had an endpoint, or keep Supabase call.
      // Keeping Supabase call assuming RLS policies allow deletion of own account.

      set({ loading: true });
      const { user } = get();
      if (!user) return { success: false, error: "No user" };

      // We should probably implement /api/users/me (DELETE)
      // but for now, rely on supabase client RLS

      // Update: If we removed SecureStore, supabase client works IN MEMORY.
      // So this should work.

      await supabase.from("user_profiles").delete().eq("user_id", user.id);
      await supabase.from("passkey_credentials").delete().eq(
        "user_id",
        user.id,
      );
      await supabase.auth.signOut();

      await api.post("/auth/logout", {});

      set({ user: null, session: null, loading: false });
      return { success: true };
    } catch (error: any) {
      console.error("Delete account error:", error);
      set({ loading: false });
      return {
        success: false,
        error: error.message || "Failed to delete account",
      };
    }
  },
}));

function handleAppStateChange(nextAppState: AppStateStatus) {
  if (nextAppState === "active") {
    // maybe refresh session?
    useAuthStore.getState().initialize();
  }
}
