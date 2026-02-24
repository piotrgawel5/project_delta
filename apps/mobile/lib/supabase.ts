import { createClient } from '@supabase/supabase-js';

const supabaseURL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Client-side Supabase client for data access (Phase 3-4 transition)
// Auth is handled via API cookies, but we use this client with an in-memory token
// to access RLS-protected data until Phase 5 (Data Flow Optimization).
export const supabase = createClient(supabaseURL, supabaseAnonKey, {
  auth: {
    persistSession: false, // In-memory only - NO SecureStore
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export const SESSION_CONFIG = {
  MAX_SESSION_DURATION: 30 * 24 * 60 * 60 * 1000,
  REFRESH_THRESHOLD: 5 * 60 * 1000,
};
