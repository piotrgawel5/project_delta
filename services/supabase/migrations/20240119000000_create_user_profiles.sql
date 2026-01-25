-- Create user_profiles table for storing onboarding data
create table if not exists public.user_profiles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade unique not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    
    -- Profile fields
    username text,
    date_of_birth date,
    weight_value numeric,
    weight_unit text check (weight_unit in ('kg', 'lbs')),
    height_value numeric,
    height_unit text check (height_unit in ('cm', 'ft')),
    height_inches numeric, -- Secondary value for feet/inches
    sex text check (sex in ('male', 'female')),
    preferred_sport text,
    activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
    goal text check (goal in ('lose_weight', 'maintain', 'build_muscle', 'improve_endurance', 'stay_healthy')),
    
    onboarding_completed boolean default false
);

-- Enable Row Level Security
alter table public.user_profiles enable row level security;

-- Users can view their own profile
create policy "Users can view own profile"
    on public.user_profiles for select
    using (auth.uid() = user_id);

-- Users can insert their own profile
create policy "Users can insert own profile"
    on public.user_profiles for insert
    with check (auth.uid() = user_id);

-- Users can update their own profile
create policy "Users can update own profile"
    on public.user_profiles for update
    using (auth.uid() = user_id);

-- Create index for faster lookups
create index if not exists user_profiles_user_id_idx on public.user_profiles(user_id);

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger set_updated_at
    before update on public.user_profiles
    for each row
    execute function public.handle_updated_at();
