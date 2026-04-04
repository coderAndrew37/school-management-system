CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 1. Insert into Profiles
  INSERT INTO public.profiles (id, full_name, role, roles)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'parent'::public.user_role,
    ARRAY['parent'::public.user_role]
  );

  -- 2. Insert into Parents
  INSERT INTO public.parents (id, full_name, email, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Parent'),
    NEW.email,
    COALESCE(NEW.phone, 'N/A')
  );

  -- 3. FIX: Set the metadata DIRECTLY on the NEW record 
  -- This avoids the UPDATE auth.users deadlock entirely.
  NEW.raw_app_meta_data := 
    jsonb_set(
      COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"parent"'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;