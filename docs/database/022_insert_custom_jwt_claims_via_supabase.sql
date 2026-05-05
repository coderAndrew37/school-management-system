CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  initial_role text;
BEGIN
  initial_role := COALESCE(NEW.raw_user_meta_data->>'role', 'parent');

  INSERT INTO public.profiles (
    id,
    full_name,
    role,
    roles
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    initial_role::public.user_role,
    ARRAY[initial_role::public.user_role]
  )
  ON CONFLICT (id) DO NOTHING;

  -- Sync app metadata
  NEW.raw_app_meta_data := jsonb_set(
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(initial_role)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;