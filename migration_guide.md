# Migration Guide: From Context to Zustand

## What Changed

✅ **Kept:**
- Your entire AuthSheet UI and animations
- Google Sign-In logic (`signInWithGoogle` function)
- Your existing Supabase client setup
- NativeWind/Tailwind styling

🔄 **Replaced:**
- Context API → Zustand store
- Basic auth functions → Enhanced store methods with validation
- Manual session checks → Automatic refresh & 30-day validation

## Step-by-Step Migration

### 1. Install Dependencies (if not already installed)

```bash
npx expo install zustand
npx expo install expo-secure-store
```

### 2. Update Your File Structure

```
├── lib/
│   ├── supabase.ts          # Enhanced with SecureStore
│   └── auth.ts              # Keep your Google signIn function
├── store/
│   └── authStore.ts         # NEW - Zustand store
├── components/
│   └── auth/
│       ├── AuthSheet.tsx    # No changes needed
│       ├── EmailForm.tsx    # NEW - Replaces inline form
│       └── Buttons.tsx      # No changes needed
└── app/
    └── _layout.tsx          # Replace AuthProvider with initialize
```

### 3. Keep Your Existing Google Auth

Your `lib/auth.ts` stays exactly as-is:

```typescript
// lib/auth.ts - NO CHANGES NEEDED
export async function signInWithGoogle(webClientID: string) {
  if (!webClientID) throw new Error('Missing Google Web Client ID');

  const { idToken } = await CredentialsAuth.signInWithGoogleAutoSelect(webClientID, false);
  if (!idToken) throw new Error('No ID token returned');

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  } as any);

  if (error) throw error;
  return true;
}
```

### 4. Replace Your AuthProvider

**Old (lib/auth.tsx):**
```typescript
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
```

**New (app/_layout.tsx):**
```typescript
export default function RootLayout() {
  const { initialize, initialized, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (!initialized || loading) {
    return <View><ActivityIndicator /></View>;
  }

  return <Stack>{/* your routes */}</Stack>;
}
```

### 5. Update Auth State Usage

**Old:**
```typescript
const { session, loading } = useAuth();
const isSignedIn = !!session;
```

**New:**
```typescript
const { session, user, loading } = useAuthStore();
// or use the helper:
const { isAuthenticated, user } = useAuth();
```

### 6. Remove Old Auth Functions

Delete these from your `lib/auth.ts`:
- ❌ `signInWithEmail`
- ❌ `signUpWithEmail`
- ❌ `AuthContext`
- ❌ `AuthProvider`
- ❌ `useAuth` (we have a new one)

Keep only:
- ✅ `signInWithGoogle`
- ✅ `safeSignInWithGoogle` (optional)

### 7. Protected Routes (Optional)

If you need route protection:

```typescript
// app/(app)/_layout.tsx
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function AppLayout() {
  const { user, loading } = useAuthStore();

  if (loading) return <ActivityIndicator />;
  if (!user) return <Redirect href="/" />;

  return <Stack>{/* protected routes */}</Stack>;
}
```

## What You Get

### 🔐 Enhanced Security
- Tokens in hardware-backed SecureStore
- 30-day session expiration
- Auto token refresh (5min before expiry)
- Session validation on app foreground

### ⚡ Better Performance
- Optimistic UI updates
- No unnecessary re-renders
- Efficient state management

### 🎯 Better DX
- Type-safe throughout
- Centralized auth logic
- Easy to test
- Simple to extend (passkeys ready)

## Testing Your Migration

1. **Sign in with Google** - Should work exactly as before
2. **Sign in with Email** - New UI with better validation
3. **Close app and reopen** - Should stay signed in
4. **Leave app closed for 30+ days** - Should require re-auth
5. **Switch between foreground/background** - Session refreshes automatically

## Common Issues

### "Can't find EmailForm"
Make sure you created `components/auth/EmailForm.tsx` from the artifact.

### "Zustand not found"
Run: `npx expo install zustand`

### "SecureStore not available"
Run: `npx expo install expo-secure-store`

### Google Sign-In not working
No changes needed - your existing implementation is preserved.

## Rollback Plan

If you need to rollback, just:
1. Keep your old `lib/auth.ts` with Context
2. Don't delete it until you're confident
3. You can run both systems in parallel during testing