-- Security Fix 1: Clean up orphaned generation_history records
-- Assign NULL user_id records to admin account for archival
UPDATE public.generation_history
SET user_id = (
  SELECT id FROM auth.users WHERE email = 'feifeixp@gmail.com' LIMIT 1
)
WHERE user_id IS NULL;

-- Add NOT NULL constraint to prevent future orphaned records
ALTER TABLE public.generation_history 
ALTER COLUMN user_id SET NOT NULL;

-- Security Fix 2: Restrict profiles email visibility
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create policy for users to view their own complete profile
CREATE POLICY "Users can view own profile" 
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Create a view for public profile data (without email)
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, username, created_at, updated_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Security Fix 3: Strengthen generation_history template policy
DROP POLICY IF EXISTS "Anyone can view templates" ON public.generation_history;

CREATE POLICY "Anyone can view templates"
ON public.generation_history
FOR SELECT
USING (is_template = true AND user_id IS NOT NULL);