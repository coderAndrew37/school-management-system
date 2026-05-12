-- ============================================================
-- KIBALI ACADEMY — Complete Role System Migration
-- Run once in Supabase SQL Editor
-- Handles existing schema: user_role enum, roles[], profiles table
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- STEP 1: Extend existing user_role enum with 'support' value
-- Your DB already has: admin | teacher | parent
-- ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.user_role'::regtype
      AND enumlabel  = 'support'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'support';
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- STEP 2: admin_role_definitions — the CRUD-managed role catalog
--
-- WHY TEXT PK instead of enum:
--   Postgres enums need DDL (ALTER TYPE) to add new values, which
--   cannot be done inside a transaction and is risky in production.
--   Text + FK + CHECK keeps the list editable at runtime by the
--   super admin without any schema migrations.
--
-- WHY NOT the junction table from the earlier plan:
--   A school admin has exactly one primary function at a time.
--   base_role + admin_role on profiles is the right model.
--   Junction tables add complexity for no benefit here.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_role_definitions (
  id            text        PRIMARY KEY,              -- slug: 'bursar', 'dos'
  label         text        NOT NULL,                 -- display: 'Bursar'
  description   text        NOT NULL DEFAULT '',
  allowed_paths text[]      NOT NULL DEFAULT '{}',   -- route prefixes for middleware
  is_active     boolean     NOT NULL DEFAULT true,    -- false = soft-deleted
  sort_order    smallint    NOT NULL DEFAULT 100,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_admin_role_def_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_admin_role_def_updated_at ON public.admin_role_definitions;
CREATE TRIGGER trg_admin_role_def_updated_at
  BEFORE UPDATE ON public.admin_role_definitions
  FOR EACH ROW EXECUTE FUNCTION public.handle_admin_role_def_updated_at();

-- Seed initial roles (safe to re-run — upserts)
INSERT INTO public.admin_role_definitions (id, label, description, sort_order, allowed_paths) VALUES
  ('super_admin',        'Super Administrator',  'Full system access — manages all roles, users and modules',              1,  ARRAY['/admin']),
  ('headteacher',        'Headteacher',          'Overall school leadership: admissions, students, staff, reports',        2,  ARRAY['/admin/dashboard','/admin/students','/admin/teachers','/admin/timetable','/admin/assessments','/admin/reports','/admin/admission']),
  ('deputy_headteacher', 'Deputy Headteacher',   'Academic leadership: timetable, assessments, allocation, reports',      3,  ARRAY['/admin/dashboard','/admin/timetable','/admin/assessments','/admin/allocation','/admin/reports']),
  ('bursar',             'Bursar',               'Finance and administration: fees, payments, finance reports',           4,  ARRAY['/admin/dashboard','/admin/fees','/admin/finance','/admin/payments','/admin/reports']),
  ('dos',                'Director of Studies',  'Curriculum and academic affairs: timetable, assessments, curriculum',   5,  ARRAY['/admin/dashboard','/admin/timetable','/admin/assessments','/admin/allocation','/admin/curriculum']),
  ('school_doctor',      'School Doctor',        'Health and wellbeing: student health records',                          6,  ARRAY['/admin/dashboard','/admin/health','/admin/students']),
  ('librarian',          'Librarian',            'Library management: books, borrowing records, resources',               7,  ARRAY['/admin/dashboard','/admin/library'])
ON CONFLICT (id) DO UPDATE SET
  label         = EXCLUDED.label,
  description   = EXCLUDED.description,
  sort_order    = EXCLUDED.sort_order,
  allowed_paths = EXCLUDED.allowed_paths;

-- ────────────────────────────────────────────────────────────
-- STEP 3: Add base_role + admin_role to profiles
--
-- base_role mirrors the existing 'role' column (text, not enum)
--   so the new system can read it without enum casting issues.
-- admin_role FK → admin_role_definitions so:
--   - invalid role IDs are rejected at DB level
--   - ON DELETE SET NULL means deactivating a role definition
--     clears it from all profiles automatically (needs reassignment)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS base_role  text NOT NULL DEFAULT 'parent',
  ADD COLUMN IF NOT EXISTS admin_role text NULL
    REFERENCES public.admin_role_definitions(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- STEP 4: Backfill base_role from existing role column
-- WHERE clause prevents double-backfill on re-run
-- ────────────────────────────────────────────────────────────

UPDATE public.profiles
SET    base_role = role::text
WHERE  base_role = 'parent';   -- only rows still on the default

-- ────────────────────────────────────────────────────────────
-- STEP 5: CHECK constraint — admin_role requires base_role='admin'
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_admin_role_requires_admin_base;

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_admin_role_requires_admin_base
  CHECK (admin_role IS NULL OR base_role = 'admin');

-- ────────────────────────────────────────────────────────────
-- STEP 6: role_audit_logs
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.role_audit_logs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid        NOT NULL,
  target_id       uuid        NOT NULL,
  -- action values:
  --   'role_assigned'       user given a new role
  --   'role_revoked'        user's admin_role stripped (back to base only)
  --   'role_def_created'    new admin role type created
  --   'role_def_updated'    admin role type label/paths changed
  --   'role_def_deactivated' admin role type disabled
  action          text        NOT NULL,
  previous_values jsonb       NOT NULL DEFAULT '{}',
  new_values      jsonb       NOT NULL DEFAULT '{}',
  reason          text        NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_audit_actor  ON public.role_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_target ON public.role_audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_role_audit_action ON public.role_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_role_audit_ts     ON public.role_audit_logs(created_at DESC);

-- ────────────────────────────────────────────────────────────
-- STEP 7: Indexes on profiles for the new columns
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_base_role  ON public.profiles(base_role);
CREATE INDEX IF NOT EXISTS idx_profiles_admin_role ON public.profiles(admin_role);

-- ────────────────────────────────────────────────────────────
-- STEP 8: RLS
-- ────────────────────────────────────────────────────────────

-- admin_role_definitions
--   Read: all authenticated users (middleware + login flow need this)
--   Write: super_admin only (via service role in server actions)
ALTER TABLE public.admin_role_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active role definitions" ON public.admin_role_definitions;
CREATE POLICY "Authenticated users can read active role definitions"
  ON public.admin_role_definitions FOR SELECT
  TO authenticated
  USING (true);   -- is_active filter applied in application layer

-- role_audit_logs
--   Read: super_admin only
--   Write: service role only (never via client)
ALTER TABLE public.role_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can read audit logs" ON public.role_audit_logs;
CREATE POLICY "Super admins can read audit logs"
  ON public.role_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id    = auth.uid()
        AND profiles.admin_role = 'super_admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- STEP 9: Trigger — sync role changes into app_metadata
--
-- The middleware reads app_metadata.role / app_metadata.admin_role
-- for ZERO database round-trips on every request.
-- After any profile role change we push the new values there.
-- This runs AFTER UPDATE on profiles so it sees the committed values.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_profile_role_to_app_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_paths text[];
BEGIN
  -- Only fire when something actually changed
  IF (OLD.base_role  IS DISTINCT FROM NEW.base_role) OR
     (OLD.admin_role IS DISTINCT FROM NEW.admin_role) THEN

    -- Look up allowed_paths for the new admin_role (NULL-safe)
    IF NEW.admin_role IS NOT NULL THEN
      SELECT allowed_paths INTO v_allowed_paths
      FROM   public.admin_role_definitions
      WHERE  id = NEW.admin_role;
    ELSE
      v_allowed_paths := '{}';
    END IF;

    UPDATE auth.users
    SET    raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
             'role',        NEW.base_role,
             'roles',       to_jsonb(ARRAY[NEW.base_role]),
             'admin_role',  NEW.admin_role,
             'admin_paths', to_jsonb(COALESCE(v_allowed_paths, '{}'))
           )
    WHERE  id = NEW.id;

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role_to_app_metadata ON public.profiles;
CREATE TRIGGER trg_sync_profile_role_to_app_metadata
  AFTER UPDATE OF base_role, admin_role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_to_app_metadata();

-- ────────────────────────────────────────────────────────────
-- STEP 10: Bootstrap your super admin
-- Uncomment, replace the UUID, then run.
-- ────────────────────────────────────────────────────────────

-- UPDATE public.profiles
-- SET    base_role = 'admin', admin_role = 'super_admin'
-- WHERE  id = 'YOUR-SUPER-ADMIN-UUID-HERE';

-- ────────────────────────────────────────────────────────────
-- STEP 11: Verify everything landed correctly
-- ────────────────────────────────────────────────────────────

SELECT 'profiles'              AS entity, count(*) AS rows FROM public.profiles
UNION ALL
SELECT 'admin_role_definitions', count(*)                  FROM public.admin_role_definitions
UNION ALL
SELECT 'role_audit_logs',        count(*)                  FROM public.role_audit_logs;

SELECT id, label, is_active, sort_order, array_length(allowed_paths, 1) AS path_count
FROM   public.admin_role_definitions
ORDER  BY sort_order;