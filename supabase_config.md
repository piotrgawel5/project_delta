# Supabase Configuration Guide

## 1. Authentication Settings

Navigate to **Authentication** → **Settings** in your Supabase dashboard:

### Email Auth Settings
- ✅ Enable Email provider
- ⚠️ **Disable email confirmation** (for now, enable later in production)
  - Under "Email Auth", set **Enable email confirmations** to OFF
- Set **Minimum password length**: 8

### Session Settings
- **JWT expiry limit**: 2592000 seconds (30 days)
- **Refresh token rotation**: Enabled (recommended)
- **Reuse interval**: 10 seconds

### Security Settings
- **Enable phone confirmations**: OFF (not using phone auth)
- **Enable manual linking**: OFF (for security)

## 2. Email Templates (Optional for later)

When you enable email verification, customize these templates:

### Confirm Signup Template
```html
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm Email</a></p>
```

### Reset Password Template  
```html
<h2>Reset Password</h2>
<p>Follow this link to reset your password:</p>
<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>
```

## 3. URL Configuration

Add your app scheme to **Redirect URLs** (needed for passkeys later):

- `your-app-scheme://auth/callback`
- `your-app-scheme://**`

## 4. Database Setup (Optional)

Create a user profiles table if needed:

```sql
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Users can only see their own profile
create policy "Users can view own profile"
  on profiles for select
  using ( auth.uid() = id );

-- Users can update their own profile
create policy "Users can update own profile"
  on profiles for update
  using ( auth.uid() = id );

-- Create profile on signup (trigger)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 5. Security Checklist

- ✅ Anon key is safe to expose (it's public by design)
- ✅ Service role key should NEVER be in your app (server-side only)
- ✅ RLS policies enabled on all tables
- ✅ Secure storage used for tokens (expo-secure-store)
- ✅ Auto token refresh enabled
- ✅ Session validation on app foreground

## 6. Testing Your Setup

1. Start your app: `npx expo start`
2. Create a test account via sign up screen
3. Verify user appears in Supabase Dashboard → Authentication → Users
4. Test sign out and sign in
5. Close app and reopen - should stay signed in
6. Leave app closed for 5+ minutes - should refresh session automatically

## Next Steps: Passkey Integration

When ready to add passkeys:

1. Install WebAuthn library: `npx expo install @github/webauthn-json`
2. Enable WebAuthn in Supabase (currently in beta)
3. Implement registration and authentication flows in `passkeyAuth` helpers
4. Update Supabase RLS policies to support passkey credentials