-- 1. Safely remove the old table if resetting, or adapt its layout
DROP TABLE IF EXISTS public.system_settings CASCADE;

-- 2. Create the refined, strict multi-tenant layout
CREATE TABLE public.system_settings (
  school_id uuid NOT NULL,
  school_name text NOT NULL DEFAULT 'Kibali Academy'::text,
  school_motto text NULL,
  school_address text NULL,
  school_phone text NULL,
  school_email text NULL,
  logo_url text NULL,
  
  -- Temporal Sync Vectors
  current_term integer NOT NULL DEFAULT 1,
  current_academic_year integer NOT NULL DEFAULT 2026,
  
  -- Flexible Term Boundaries
  term_start_date date NULL,
  term_end_date date NULL,
  next_term_opening_date date NULL,
  
  -- Operational Parameters
  sms_notifications_enabled boolean NOT NULL DEFAULT true,
  email_notifications_enabled boolean NOT NULL DEFAULT true,
  
  -- Telemetry & Tracking
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid NULL,

  -- Constraints
  CONSTRAINT system_settings_pkey PRIMARY KEY (school_id),
  CONSTRAINT system_settings_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools (id) ON DELETE CASCADE,
  CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles (id) ON DELETE SET NULL,
  CONSTRAINT system_settings_term_check CHECK (current_term IN (1, 2, 3)),
  CONSTRAINT system_settings_year_check CHECK (current_academic_year >= 2020 AND current_academic_year <= 2040)
) TABLESPACE pg_default;

-- 3. Register standard updated_at automation hook
CREATE TRIGGER system_settings_updated_at 
  BEFORE UPDATE ON public.system_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION set_updated_at();


  -- Create the JWT sync function for global configuration changes
CREATE OR REPLACE FUNCTION public.handle_system_settings_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Batch update the auth.users app_metadata for all accounts belonging to the school
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{current_term}', to_jsonb(NEW.current_term)
    ),
    '{current_academic_year}', to_jsonb(NEW.current_academic_year)
  )
  WHERE id IN (
    SELECT id FROM public.profiles WHERE school_id = NEW.school_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the execution trigger to settings updates
CREATE TRIGGER trg_sync_system_settings_to_jwt
  AFTER UPDATE OF current_term, current_academic_year ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_system_settings_sync();

  -- 1. Permissive Read Policy for Institutional Members
CREATE POLICY "Allow school members to view system settings" 
ON public.system_settings
FOR SELECT 
TO authenticated
USING (
  school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

-- 2. Restrictive Write Policy for School Administrators
CREATE POLICY "Allow school admins to modify system settings" 
ON public.system_settings
FOR ALL -- Covers INSERT, UPDATE, and DELETE
TO authenticated
USING (
  school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  AND 
  (SELECT base_role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.user_role
)
WITH CHECK (
  school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  AND 
  (SELECT base_role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.user_role
);

-- Drop the overly broad policy and split it cleanly
DROP POLICY IF EXISTS "Allow school admins to modify system settings" ON public.system_settings;

-- UPDATE / DELETE — needs USING (row must belong to school)
CREATE POLICY "Allow school admins to update system settings"
ON public.system_settings
FOR UPDATE
TO authenticated
USING (
  school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  AND (SELECT base_role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.user_role
)
WITH CHECK (
  school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  AND (SELECT base_role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.user_role
);

CREATE POLICY "Allow school admins to delete system settings"
ON public.system_settings
FOR DELETE
TO authenticated
USING (
  school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  AND (SELECT base_role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.user_role
);

-- INSERT — no USING clause, only WITH CHECK
CREATE POLICY "Allow school admins to insert system settings"
ON public.system_settings
FOR INSERT
TO authenticated
WITH CHECK (
  school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  AND (SELECT base_role FROM public.profiles WHERE id = auth.uid()) = 'admin'::public.user_role
);