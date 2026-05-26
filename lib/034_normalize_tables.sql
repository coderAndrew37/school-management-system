-- Drop the old table completely along with its dependencies
DROP TABLE IF EXISTS public.teachers CASCADE;

-- Create the clean, normalized professional extension table
CREATE TABLE public.teachers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  staff_id text NULL,
  tsc_number text NULL,
  status text NOT NULL DEFAULT 'active'::text,
  last_invite_sent timestamp with time zone NULL,
  invite_accepted boolean NOT NULL DEFAULT false,
  archived_at timestamp with time zone NULL,
  transfer_destination_school text NULL,
  transfer_date timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  -- Structural constraints
  CONSTRAINT teachers_pkey PRIMARY KEY (id),
  CONSTRAINT teachers_staff_id_key UNIQUE (staff_id),
  CONSTRAINT teachers_tsc_number_key UNIQUE (tsc_number),
  CONSTRAINT teachers_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools (id) ON DELETE CASCADE,
  CONSTRAINT teachers_status_check CHECK (
    status = ANY (
      ARRAY[
        'active'::text,
        'on_leave'::text,
        'transferred'::text,
        'terminated'::text,
        'resigned'::text,
        'deceased'::text,
        'retired'::text
      ]
    )
  )
) TABLESPACE pg_default;

-- Performance indexing for fast school isolation lookups
CREATE INDEX IF NOT EXISTS idx_teachers_school ON public.teachers USING btree (school_id);
CREATE INDEX IF NOT EXISTS idx_teachers_status ON public.teachers USING btree (status);
CREATE INDEX IF NOT EXISTS idx_teachers_staff_id ON public.teachers USING btree (staff_id);

-- Reactivate your custom automatic staff ID generator trigger
CREATE TRIGGER tr_set_teacher_staff_id BEFORE INSERT ON public.teachers FOR EACH ROW
EXECUTE FUNCTION generate_kibali_staff_id ();

-- Enable RLS on the new table
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Users can view teachers only within their own school tenant
CREATE POLICY "Users can view teachers in their school" 
  ON public.teachers
  FOR SELECT 
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_dev')::boolean = true
    OR (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    OR school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
  );

-- 2. INSERT: Only School Admins, Super Admins, and Developers can onboard new staff
CREATE POLICY "Admins can onboard teachers into their school" 
  ON public.teachers
  FOR INSERT 
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'is_dev')::boolean = true
    OR (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    -- Check role and match tenant path
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' 
      AND school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
    )
  );

-- 3. UPDATE: Admins modify records; Teachers update their own invite/status fields via domain actions
CREATE POLICY "Admins and teachers can update tracking attributes" 
  ON public.teachers
  FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_dev')::boolean = true
    OR (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' 
      AND school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
    )
    -- Allow a teacher to modify their own extension record path via action executors
    OR id = (auth.jwt() -> 'app_metadata' ->> 'teacher_id')::uuid
  );

-- 4. DELETE: Complete structural deletion is heavily guarded (typically restricted to devs/super admins)
CREATE POLICY "Only system controllers can hard delete records" 
  ON public.teachers
  FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'is_dev')::boolean = true
    OR (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
  );

  -- 1. Add the explicit foreign key relation to profiles pointing to teachers
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_teacher_id_fkey 
  FOREIGN KEY (teacher_id) 
  REFERENCES public.teachers (id) 
  ON DELETE SET NULL;

-- 2. Force PostgREST to rebuild its join cache maps
NOTIFY pgrst, 'reload schema';