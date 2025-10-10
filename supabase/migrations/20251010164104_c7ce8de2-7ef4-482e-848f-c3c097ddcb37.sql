-- Fix SECURITY DEFINER on public_profiles view
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles 
WITH (security_invoker=true) AS
SELECT id, username, created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Remove hardcoded admin email from handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := NEW.email;
  
  -- Insert user profile
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(user_email, '@', 1)),
    user_email
  );
  
  -- Assign default user role (admin roles should be managed manually via dashboard)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;