-- Add email column to passkey_challenges for registration flow
ALTER TABLE public.passkey_challenges 
ADD COLUMN IF NOT EXISTS email text;

-- Create index for faster lookup by email
CREATE INDEX IF NOT EXISTS passkey_challenges_email_idx 
ON public.passkey_challenges(email);

-- Add external_id column if missing (for user display name)
ALTER TABLE public.passkey_credentials 
ADD COLUMN IF NOT EXISTS external_id text;
