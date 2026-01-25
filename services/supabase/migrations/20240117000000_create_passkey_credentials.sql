-- Create a table for storing passkey credentials
create table if not exists public.passkey_credentials (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Link to the user in auth.users
    user_id uuid references auth.users(id) on delete cascade not null,
    
    -- WebAuthn specific fields
    credential_id text not null, -- The base64url encoded credential ID
    external_id text not null, -- The external ID for the user (usually same as user_id or a per-user random string)
    public_key jsonb not null, -- The public key and other metadata
    counter bigint default 0, -- Sign count for replay protection
    transports jsonb, -- Array of supported transports (usb, nfc, ble, internal)
    
    unique(credential_id)
);

-- Enable Row Level Security
alter table public.passkey_credentials enable row level security;

-- Policies
-- Users can view their own credentials
create policy "Users can view own credentials"
    on public.passkey_credentials for select
    using (auth.uid() = user_id);

-- Users can delete their own credentials
create policy "Users can delete own credentials"
    on public.passkey_credentials for delete
    using (auth.uid() = user_id);

-- Service role (server-side functions) can do everything
create policy "Service role can do everything"
    on public.passkey_credentials
    using (true)
    with check (true);

-- Create an index on specific user's credentials for faster lookups
create index if not exists passkey_credentials_user_id_idx on public.passkey_credentials(user_id);
create index if not exists passkey_credentials_credential_id_idx on public.passkey_credentials(credential_id);

-- Create a table for storing challenges (stateful WebAuthn)
create table if not exists public.passkey_challenges (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    challenge text not null,
    user_id uuid references auth.users(id) on delete cascade
);

-- RLS for challenges
alter table public.passkey_challenges enable row level security;

create policy "Service role can do everything on challenges"
    on public.passkey_challenges
    using (true)
    with check (true);
