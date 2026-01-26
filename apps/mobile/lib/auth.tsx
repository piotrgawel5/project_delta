import React, { createContext, useContext, useEffect, useState } from 'react';
import CredentialAuth from '@modules/credentials-auth';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Alert } from 'react-native';

const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
}>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// apps/mobile/lib/auth.tsx
import { api } from '@lib/api';

export async function signInWithGoogle(webClientID: string) {
  console.log('[Google SignIn] Starting, webClientID:', webClientID ? 'present' : 'MISSING');

  if (!webClientID) throw new Error('Missing Google Web Client ID');

  console.log('[Google SignIn] Calling native signInWithGoogleAutoSelect...');
  const { idToken } = await CredentialAuth.signInWithGoogleAutoSelect(webClientID, false);
  console.log('[Google SignIn] Got idToken:', idToken ? 'present' : 'MISSING');

  if (!idToken) throw new Error('No ID token returned');

  console.log('[Google SignIn] Calling API /auth/google/login...');
  // Call API instead of Supabase directly
  const response = await api.post('/auth/google/login', { idToken });
  console.log('[Google SignIn] API response:', response?.user ? 'has user' : 'no user');

  if (response.user) {
    if (response.access_token && response.refresh_token) {
      console.log('[Google SignIn] Setting Supabase session...');
      await supabase.auth.setSession({
        access_token: response.access_token,
        refresh_token: response.refresh_token,
      });
      console.log('[Google SignIn] Session set successfully');
    }
  }

  console.log('[Google SignIn] Complete!');
  return true;
}

export async function signInWithEmail(email: string, password: string) {
  if (!email || !password) throw new Error('Missing email or password');

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  if (!email || !password) throw new Error('Missing email or password');

  const { error, data } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function safeSignInWithGoogle(webClientId: string) {
  try {
    await signInWithGoogle(webClientId);
    return { ok: true };
  } catch (err: any) {
    console.error('[Google SignIn]', err);
    Alert.alert('Login failed', err?.message ?? 'Unknown error');
    return { ok: false, error: err };
  }
}
