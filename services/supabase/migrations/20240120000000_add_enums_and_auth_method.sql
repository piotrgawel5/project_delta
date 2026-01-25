-- Migration: Add enum types and auth method tracking
-- File: 20240120000000_add_enums_and_auth_method.sql

-- Create enum types for better database optimization
DO $$ BEGIN
    CREATE TYPE sex_enum AS ENUM ('male', 'female');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE activity_level_enum AS ENUM ('sedentary', 'light', 'moderate', 'active', 'very_active');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE goal_enum AS ENUM ('lose_weight', 'maintain', 'build_muscle', 'improve_endurance', 'stay_healthy');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE weight_unit_enum AS ENUM ('kg', 'lbs');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE height_unit_enum AS ENUM ('cm', 'ft');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE auth_method_enum AS ENUM ('password', 'google', 'passkey');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add auth method columns to user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS primary_auth_method auth_method_enum DEFAULT 'password';

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS has_passkey boolean DEFAULT false;

-- Add avatar_url column for profile pictures
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add username_changed_at for tracking username change cooldown
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;

-- Create index for faster lookups by auth method
CREATE INDEX IF NOT EXISTS user_profiles_auth_method_idx ON public.user_profiles(primary_auth_method);

-- Note: We keep the existing text columns for backward compatibility
-- The app will handle the conversion between text and enum values
-- In a production environment, you would migrate the data and change column types

-- Create storage bucket for avatars (this is done via Supabase dashboard or API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
