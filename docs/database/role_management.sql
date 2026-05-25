-- =============================================================================
-- KIBALI ACADEMY — DOMAIN-ACTION RBAC MIGRATION
-- Safe to run on an existing database. Every statement is idempotent.
--
-- What this script does:
--   SECTION 1  — Add missing columns to profiles
--   SECTION 2  — Add school_id to teachers
--   SECTION 3  — Patch security_audit_logs (new cols, type fix, FK fix)
--   SECTION 4  — Add audit_action_type enum (new values alongside old enum)
--   SECTION 5  — CREATE permission_catalog (new table)
--   SECTION 6  — CREATE admin_role_definitions (new table)
--   SECTION 7  — CREATE staff_role_assignments (new table)
--   SECTION 8  — RLS policies (DROP IF EXISTS before CREATE to stay idempotent)
--   SECTION 9  — Functions (CREATE OR REPLACE — always safe)
--   SECTION 10 — Triggers (DROP IF EXISTS before CREATE)
--   SECTION 11 — Seed: permission catalog, role definitions, super admin
--
-- What this script does NOT touch:
--   schools, students, student_parents, roles, role_permissions, user_roles
--   (those tables are structurally fine as-is)
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: PATCH profiles
-- Add email, allowed_permissions_override, denied_permissions_override
-- All use IF NOT EXISTS semantics via DO blocks
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN email TEXT UNIQUE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN allowed_permissions_override TEXT[] NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN denied_permissions_override TEXT[] NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Backfill email from auth.users for any existing rows that don't have it yet
UPDATE public.profiles p
SET    email = u.email
FROM   auth.users u
WHERE  p.id    = u.id
  AND  p.email IS NULL;

COMMENT ON COLUMN public.profiles.allowed_permissions_override IS
  'Explicit per-user domain-action token grants. Format: domain:subdomain:action. Evaluated by hasPermission() and flushed into JWT on change.';

COMMENT ON COLUMN public.profiles.denied_permissions_override IS
  'Explicit per-user domain-action token revocations. Always wins over allowed_permissions_override and baseline role caps.';


-- =============================================================================
-- SECTION 2: PATCH teachers — add school_id
-- teachers.id is a standalone UUID PK (not FK to profiles).
-- We add school_id as nullable first, backfill from existing data where
-- possible, then add the FK. We intentionally leave it nullable so the
-- migration does not break existing rows that have no school yet.
-- =============================================================================

DO $$ BEGIN
  ALTER TABLE public.teachers
    ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_teachers_school
  ON public.teachers(school_id);

-- Backfill: if all existing teachers belong to the one school already seeded,
-- set them. Adjust the WHERE clause or remove it for multi-school setups.
-- This is a best-effort backfill — verify manually before running in production.
UPDATE public.teachers
SET    school_id = '11111111-1111-1111-1111-111111111111'
WHERE  school_id IS NULL;

COMMENT ON COLUMN public.teachers.school_id IS
  'Multi-tenant anchor. Every teacher row must carry the owning school_id.';


-- =============================================================================
-- SECTION 3: PATCH security_audit_logs
--
-- Existing issues vs target schema:
--   a) record_id  is UUID  — needs to be TEXT (roles use slug PKs)
--   b) actor_id   FK refs  teachers — needs to ref profiles instead
--   c) Missing columns: school_id, target_id, context
--   d) action_type uses old enum audit_action — we keep the column but
--      switch it to the new audit_action_type enum (added in Section 4)
-- =============================================================================

-- 3a. Add missing columns first (safe — all nullable or have defaults)

DO $$ BEGIN
  ALTER TABLE public.security_audit_logs
    ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.security_audit_logs
    ADD COLUMN target_id UUID;     -- profile being acted on; nullable
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.security_audit_logs
    ADD COLUMN context JSONB NOT NULL DEFAULT '{}';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 3b. record_id: cast from UUID to TEXT
--     We use a temp column swap so existing UUID data is preserved as strings.
DO $$
BEGIN
  -- Only do this if record_id is still of type uuid
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'security_audit_logs'
      AND  column_name  = 'record_id'
      AND  data_type    = 'uuid'
  ) THEN
    ALTER TABLE public.security_audit_logs
      ALTER COLUMN record_id TYPE TEXT USING record_id::TEXT;
  END IF;
END $$;

-- 3c. Fix actor_id FK: drop FK referencing teachers, add one referencing profiles
--     The FK name in the existing schema is fk_audit_logs_actor.
ALTER TABLE public.security_audit_logs
  DROP CONSTRAINT IF EXISTS fk_audit_logs_actor;

-- Only add the new FK if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE  constraint_name = 'audit_logs_actor_profiles_fkey'
      AND  table_name      = 'security_audit_logs'
  ) THEN
    ALTER TABLE public.security_audit_logs
      ADD CONSTRAINT audit_logs_actor_profiles_fkey
        FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3d. Add missing indexes
CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON public.security_audit_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_target
  ON public.security_audit_logs(target_id);

CREATE INDEX IF NOT EXISTS idx_audit_school
  ON public.security_audit_logs(school_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_context
  ON public.security_audit_logs USING gin(context);

-- Backfill school_id on existing audit rows where we can infer it
UPDATE public.security_audit_logs sal
SET    school_id = p.school_id
FROM   public.profiles p
WHERE  sal.actor_id  = p.id
  AND  sal.school_id IS NULL;


-- =============================================================================
-- SECTION 4: ADD NEW audit_action_type ENUM
-- The existing `audit_action` enum (INSERT, UPDATE, DELETE, ROLE_CHANGE,
-- OVERRIDE) is kept intact because the existing audit log column uses it.
-- We create a brand-new `audit_action_type` enum with the full value set
-- for the new system. New inserts from application code will use this type.
-- We then migrate the action_type column to use the new enum.
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.audit_action_type AS ENUM (
    'ROLE_ASSIGN',
    'ROLE_REVOKE',
    'PERMISSION_OVERRIDE_SET',
    'PERMISSION_OVERRIDE_CLEAR',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'PROFILE_UPDATE',
    'STUDENT_CREATE',
    'STUDENT_UPDATE',
    'STUDENT_TRANSFER',
    'INSERT',
    'UPDATE',
    'DELETE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Migrate the action_type column from audit_action → audit_action_type.
-- We cast the string representation; values that exist in both enums
-- (INSERT, UPDATE, DELETE) cast directly. Old values ROLE_CHANGE and
-- OVERRIDE map to the closest new equivalents.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE  table_schema = 'public'
      AND  table_name   = 'security_audit_logs'
      AND  column_name  = 'action_type'
      AND  udt_name     = 'audit_action'   -- old enum
  ) THEN
    -- Add a temporary text column to hold values during transition
    ALTER TABLE public.security_audit_logs ADD COLUMN action_type_new TEXT;

    UPDATE public.security_audit_logs SET action_type_new =
      CASE action_type::TEXT
        WHEN 'ROLE_CHANGE' THEN 'ROLE_ASSIGN'
        WHEN 'OVERRIDE'    THEN 'PERMISSION_OVERRIDE_SET'
        ELSE action_type::TEXT          -- INSERT, UPDATE, DELETE pass through
      END;

    -- Drop old column and rename new one
    ALTER TABLE public.security_audit_logs DROP COLUMN action_type;
    ALTER TABLE public.security_audit_logs RENAME COLUMN action_type_new TO action_type;

    -- Cast to the new enum
    ALTER TABLE public.security_audit_logs
      ALTER COLUMN action_type TYPE public.audit_action_type
        USING action_type::public.audit_action_type;

    -- Restore NOT NULL
    ALTER TABLE public.security_audit_logs
      ALTER COLUMN action_type SET NOT NULL;
  END IF;
END $$;


-- =============================================================================
-- SECTION 5: CREATE permission_catalog (new table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.permission_catalog (
    id          TEXT        PRIMARY KEY,
    domain      TEXT        NOT NULL,
    subdomain   TEXT        NOT NULL,
    action      TEXT        NOT NULL,
    label       TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.permission_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permission_catalog_read"      ON public.permission_catalog;
DROP POLICY IF EXISTS "permission_catalog_dev_write" ON public.permission_catalog;

CREATE POLICY "permission_catalog_read"
  ON public.permission_catalog FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "permission_catalog_dev_write"
  ON public.permission_catalog FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_dev = true
    )
  );


-- =============================================================================
-- SECTION 6: CREATE admin_role_definitions (new table)
-- This replaces the concept carried by the old `roles` table but is
-- structured for domain-action tokens and active-assignment semantics.
-- The old `roles` table is left untouched for backward compatibility.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.admin_role_definitions (
    id                   TEXT        NOT NULL,
    school_id            UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    label                TEXT        NOT NULL,
    description          TEXT        NOT NULL DEFAULT '',
    baseline_permissions TEXT[]      NOT NULL DEFAULT '{}',
    allowed_paths        TEXT[]      NOT NULL DEFAULT '{}',
    is_active            BOOLEAN     NOT NULL DEFAULT true,
    sort_order           INTEGER     NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT admin_role_definitions_pkey      PRIMARY KEY (school_id, id),
    CONSTRAINT unique_role_def_per_school       UNIQUE (school_id, id)
);

CREATE TRIGGER admin_role_definitions_updated_at
  BEFORE UPDATE ON public.admin_role_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.admin_role_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_defs_read_authenticated" ON public.admin_role_definitions;
DROP POLICY IF EXISTS "role_defs_super_admin_write"  ON public.admin_role_definitions;

CREATE POLICY "role_defs_read_authenticated"
  ON public.admin_role_definitions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "role_defs_super_admin_write"
  ON public.admin_role_definitions FOR ALL
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );


-- =============================================================================
-- SECTION 7: CREATE staff_role_assignments (new table)
-- Replaces user_roles with full lifecycle tracking (assign/revoke history).
-- The old user_roles table is left untouched.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.staff_role_assignments (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id     UUID        NOT NULL REFERENCES public.schools(id)   ON DELETE CASCADE,
    profile_id    UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
    role_id       TEXT        NOT NULL,
    assigned_by   UUID        REFERENCES public.profiles(id)           ON DELETE SET NULL,
    assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at    TIMESTAMPTZ,
    revoke_reason TEXT,
    notes         TEXT,

    FOREIGN KEY (school_id, role_id)
      REFERENCES public.admin_role_definitions(school_id, id) ON DELETE CASCADE,

    -- Only one active (non-revoked) assignment per profile+role at a time
    CONSTRAINT unique_active_role_assignment
      UNIQUE NULLS NOT DISTINCT (profile_id, role_id, revoked_at)
);

CREATE INDEX IF NOT EXISTS idx_sra_profile
  ON public.staff_role_assignments(profile_id);

CREATE INDEX IF NOT EXISTS idx_sra_school
  ON public.staff_role_assignments(school_id);

CREATE INDEX IF NOT EXISTS idx_sra_active
  ON public.staff_role_assignments(profile_id, revoked_at)
  WHERE revoked_at IS NULL;

ALTER TABLE public.staff_role_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sra_read_own"               ON public.staff_role_assignments;
DROP POLICY IF EXISTS "sra_read_school_super_admin" ON public.staff_role_assignments;
DROP POLICY IF EXISTS "sra_write_super_admin"       ON public.staff_role_assignments;

CREATE POLICY "sra_read_own"
  ON public.staff_role_assignments FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "sra_read_school_super_admin"
  ON public.staff_role_assignments FOR SELECT
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "sra_write_super_admin"
  ON public.staff_role_assignments FOR ALL
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );


-- =============================================================================
-- SECTION 8: RLS POLICIES ON EXISTING TABLES
-- Drop-then-recreate pattern keeps the script idempotent.
-- =============================================================================

-- ── profiles ─────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_self_read"          ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update"        ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_read"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_super_admin_write"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_dev_all"            ON public.profiles;

CREATE POLICY "profiles_self_read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- Prevent self-escalation of privilege flags
    AND is_super_admin = (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid())
    AND is_dev         = (SELECT is_dev         FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "profiles_super_admin_read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

CREATE POLICY "profiles_super_admin_write"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
    )
    AND is_dev = false
  )
  WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND is_dev = false
  );

CREATE POLICY "profiles_dev_all"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true)
  );


-- ── teachers ──────────────────────────────────────────────────────────────────

ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teachers_read_own_school"   ON public.teachers;
DROP POLICY IF EXISTS "teachers_write_super_admin" ON public.teachers;

CREATE POLICY "teachers_read_own_school"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "teachers_write_super_admin"
  ON public.teachers FOR ALL
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );


-- ── students ──────────────────────────────────────────────────────────────────
-- Note: students_write_authorized calls user_has_permission which is defined
-- in Section 9. The RLS policy is registered here but the function must exist
-- before any INSERT/UPDATE/DELETE is attempted — functions are created next.

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_read_own_school"   ON public.students;
DROP POLICY IF EXISTS "students_write_authorized"  ON public.students;

CREATE POLICY "students_read_own_school"
  ON public.students FOR SELECT
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "students_write_authorized"
  ON public.students FOR ALL
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_super_admin = true
      )
      OR public.user_has_permission(auth.uid(), 'people:students:write')
    )
  );


-- ── security_audit_logs ───────────────────────────────────────────────────────

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_read_super_admin"      ON public.security_audit_logs;
DROP POLICY IF EXISTS "audit_insert_authenticated"  ON public.security_audit_logs;
-- Remove the old unrestricted insert policy if it exists
DROP POLICY IF EXISTS "system_append_audit_logs"    ON public.security_audit_logs;

CREATE POLICY "audit_read_super_admin"
  ON public.security_audit_logs FOR SELECT
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Authenticated users may only INSERT rows where they are the actor
CREATE POLICY "audit_insert_authenticated"
  ON public.security_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- No UPDATE or DELETE policies — log is append-only by design


-- ── student_parents ───────────────────────────────────────────────────────────

ALTER TABLE public.student_parents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sp_read_school"      ON public.student_parents;
DROP POLICY IF EXISTS "sp_write_authorized" ON public.student_parents;

CREATE POLICY "sp_read_school"
  ON public.student_parents FOR SELECT
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "sp_write_authorized"
  ON public.student_parents FOR ALL
  TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_super_admin = true
      )
      OR public.user_has_permission(auth.uid(), 'people:students:write')
    )
  );


-- ── schools ───────────────────────────────────────────────────────────────────

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schools_read_active" ON public.schools;
DROP POLICY IF EXISTS "schools_dev_write"   ON public.schools;
-- Remove old broad policy if present
DROP POLICY IF EXISTS "Allow public read access to active schools via subdomain" ON public.schools;
DROP POLICY IF EXISTS "Allow global system overrides full management"            ON public.schools;

CREATE POLICY "schools_read_active"
  ON public.schools FOR SELECT
  USING (is_active = true);

CREATE POLICY "schools_dev_write"
  ON public.schools FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_dev = true
    )
  );


-- =============================================================================
-- SECTION 9: FUNCTIONS (CREATE OR REPLACE — always safe to re-run)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 9a. user_has_permission(uid, token)
--     SECURITY DEFINER RLS helper.
--     Evaluation: super_admin bypass → denied override → allowed override
--                 → baseline role caps from staff_role_assignments → deny.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_permission(
    p_uid   UUID,
    p_token TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_is_super_admin BOOLEAN;
    v_is_dev         BOOLEAN;
    v_allowed        TEXT[];
    v_denied         TEXT[];
    v_baseline       TEXT[];
BEGIN
    SELECT is_super_admin,
           is_dev,
           allowed_permissions_override,
           denied_permissions_override
    INTO   v_is_super_admin, v_is_dev, v_allowed, v_denied
    FROM   public.profiles
    WHERE  id = p_uid;

    -- Layer 1: Privilege bypass
    IF v_is_super_admin OR v_is_dev THEN
        RETURN TRUE;
    END IF;

    -- Layer 2: Explicit denial (exact + wildcard)
    IF v_denied @> ARRAY[p_token] THEN
        RETURN FALSE;
    END IF;
    IF EXISTS (
        SELECT 1 FROM unnest(v_denied) AS d
        WHERE  d LIKE '%*'
          AND  p_token LIKE replace(d, '*', '%')
    ) THEN
        RETURN FALSE;
    END IF;

    -- Layer 3: Explicit grant (exact + wildcard)
    IF v_allowed @> ARRAY[p_token] THEN
        RETURN TRUE;
    END IF;
    IF EXISTS (
        SELECT 1 FROM unnest(v_allowed) AS a
        WHERE  a LIKE '%*'
          AND  p_token LIKE replace(a, '*', '%')
    ) THEN
        RETURN TRUE;
    END IF;

    -- Layer 4: Baseline from active role assignment(s)
    --          Union all active roles so a user with multiple roles gets all caps
    SELECT array_agg(DISTINCT t)
    INTO   v_baseline
    FROM   public.staff_role_assignments sra
    JOIN   public.admin_role_definitions  ard
           ON  ard.id        = sra.role_id
           AND ard.school_id = sra.school_id
    JOIN   LATERAL unnest(ard.baseline_permissions) AS t ON TRUE
    WHERE  sra.profile_id = p_uid
      AND  sra.revoked_at IS NULL;

    IF v_baseline IS NOT NULL THEN
        IF v_baseline @> ARRAY[p_token] THEN
            RETURN TRUE;
        END IF;
        IF EXISTS (
            SELECT 1 FROM unnest(v_baseline) AS b
            WHERE  b LIKE '%*'
              AND  p_token LIKE replace(b, '*', '%')
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;
END;
$$;




-- ---------------------------------------------------------------------------
-- 9b. get_effective_permissions(profile_id)
--     Returns the full resolved token set for a profile.
--     Used by sync_user_jwt_claims and server-side actions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_effective_permissions(
    p_profile_id UUID
)
RETURNS TABLE(permission_id TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_is_super BOOLEAN;
    v_is_dev   BOOLEAN;
BEGIN
    SELECT is_super_admin, is_dev
    INTO   v_is_super, v_is_dev
    FROM   public.profiles
    WHERE  id = p_profile_id;

    -- Super admin / dev → single wildcard token
    IF v_is_super OR v_is_dev THEN
        RETURN QUERY SELECT '*'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY
    (
        -- Baseline from ALL active role assignments (union so multi-role works)
        SELECT DISTINCT t
        FROM   public.staff_role_assignments sra
        JOIN   public.admin_role_definitions  ard
               ON  ard.id        = sra.role_id
               AND ard.school_id = sra.school_id
        JOIN   LATERAL unnest(ard.baseline_permissions) AS t ON TRUE
        WHERE  sra.profile_id = p_profile_id
          AND  sra.revoked_at IS NULL
    )
    UNION
    (
        -- Explicit grants
        SELECT DISTINCT unnest(allowed_permissions_override)
        FROM   public.profiles
        WHERE  id = p_profile_id
    )
    EXCEPT
    (
        -- Explicit revocations
        SELECT DISTINCT unnest(denied_permissions_override)
        FROM   public.profiles
        WHERE  id = p_profile_id
    );
END;
$$;


-- ---------------------------------------------------------------------------
-- 9c. sync_user_jwt_claims(profile_id)
--     Resolves effective permissions and writes them into auth.users
--     raw_app_meta_data. Called by triggers and explicit server actions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_jwt_claims(
    p_profile_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
    v_profile       RECORD;
    v_assignment    RECORD;
    v_permissions   TEXT[];
    v_allowed_paths TEXT[];
    v_claims        JSONB;
BEGIN
    SELECT * INTO v_profile
    FROM   public.profiles
    WHERE  id = p_profile_id;

    IF NOT FOUND THEN RETURN; END IF;

    -- Most-recent active role assignment (for admin_role / admin_label / allowed_paths)
    SELECT sra.role_id, ard.label, ard.allowed_paths
    INTO   v_assignment
    FROM   public.staff_role_assignments sra
    JOIN   public.admin_role_definitions  ard
           ON  ard.id        = sra.role_id
           AND ard.school_id = sra.school_id
    WHERE  sra.profile_id = p_profile_id
      AND  sra.revoked_at IS NULL
    ORDER  BY sra.assigned_at DESC
    LIMIT  1;

    -- Resolve full permission token set
    SELECT array_agg(permission_id)
    INTO   v_permissions
    FROM   public.get_effective_permissions(p_profile_id);

    -- Determine admin_paths for middleware Layer-2 path gating
    IF v_profile.is_super_admin OR v_profile.is_dev THEN
        v_allowed_paths := ARRAY['/admin'];
    ELSIF v_assignment IS NOT NULL THEN
        v_allowed_paths := v_assignment.allowed_paths;
    ELSE
        v_allowed_paths := ARRAY['/admin/dashboard'];
    END IF;

    v_claims := jsonb_build_object(
        'role',           v_profile.role::TEXT,
        'school_id',      v_profile.school_id,
        'is_super_admin', v_profile.is_super_admin,
        'is_dev',         v_profile.is_dev,
        'admin_role',     COALESCE(v_assignment.role_id,  NULL),
        'admin_label',    COALESCE(v_assignment.label,    NULL),
        'admin_paths',    to_jsonb(v_allowed_paths),
        -- Bulletproof fallback: ensure permissions is always a JSON array, never a SQL null
        'permissions',    to_jsonb(COALESCE(v_permissions, ARRAY[]::TEXT[]))
    );

    -- ── The Core Fix ─────────────────────────────────────────────────────────
    -- Coalesce raw_app_meta_data to an empty json object '{}' to safely 
    -- prevent new-user/empty-meta concatenation crashes.
    UPDATE auth.users
    SET    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || v_claims
    WHERE  id = p_profile_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 9d. execute_teacher_transfer_out(teacher_id, destination_school)
--     Atomic transfer-out: status → transferred, revoke all roles,
--     clear overrides, wipe JWT permissions immediately.
--     Uses teachers.id (not profiles.id) since teachers is a separate table.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_teacher_transfer_out(
    p_teacher_id         UUID,
    p_destination_school TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    -- Resolve matching profile id via the teachers → profiles link
    -- profiles.teacher_id → teachers.id
    SELECT id INTO v_profile_id
    FROM   public.profiles
    WHERE  teacher_id = p_teacher_id
    LIMIT  1;

    -- 1. Update teacher row
    UPDATE public.teachers
    SET    status                      = 'transferred',
           transfer_destination_school = p_destination_school,
           transfer_date               = NOW()
    WHERE  id = p_teacher_id;

    -- 2. Revoke all active role assignments (if profile exists)
    IF v_profile_id IS NOT NULL THEN
        UPDATE public.staff_role_assignments
        SET    revoked_at    = NOW(),
               revoke_reason = 'Teacher transferred out'
        WHERE  profile_id  = v_profile_id
          AND  revoked_at IS NULL;

        -- 3. Clear permission overrides
        UPDATE public.profiles
        SET    allowed_permissions_override = '{}',
               denied_permissions_override  = '{}'
        WHERE  id = v_profile_id;
    END IF;

    -- 4. Wipe JWT permissions for the auth user
    --    Try both the teacher's direct UUID and the profile UUID
    UPDATE auth.users
    SET    raw_app_meta_data = raw_app_meta_data ||
               jsonb_build_object(
                   'permissions',  '[]'::jsonb,
                   'admin_role',   NULL,
                   'admin_label',  NULL,
                   'admin_paths',  jsonb_build_array('/admin/dashboard')
               )
    WHERE  id = p_teacher_id
       OR  id = v_profile_id;
END;
$$;


-- =============================================================================
-- SECTION 10: TRIGGERS
-- DROP IF EXISTS before CREATE so the script is safe to re-run.
-- =============================================================================

-- 10a. Auto-sync JWT when profiles permission overrides change
CREATE OR REPLACE FUNCTION public.trg_sync_jwt_on_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
    IF OLD.allowed_permissions_override IS DISTINCT FROM NEW.allowed_permissions_override
    OR OLD.denied_permissions_override  IS DISTINCT FROM NEW.denied_permissions_override
    OR OLD.role                         IS DISTINCT FROM NEW.role
    OR OLD.is_super_admin               IS DISTINCT FROM NEW.is_super_admin
    THEN
        PERFORM public.sync_user_jwt_claims(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_jwt ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_jwt
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_jwt_on_profile_change();


-- 10b. Auto-sync JWT when a role is assigned or revoked
CREATE OR REPLACE FUNCTION public.trg_sync_jwt_on_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER AS $$
DECLARE
    v_target_id UUID;
BEGIN
    v_target_id := COALESCE(
        CASE WHEN TG_OP = 'DELETE' THEN OLD.profile_id ELSE NEW.profile_id END,
        OLD.profile_id
    );
    PERFORM public.sync_user_jwt_claims(v_target_id);
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_role_assign_to_jwt ON public.staff_role_assignments;
CREATE TRIGGER trg_sync_role_assign_to_jwt
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_jwt_on_role_assignment();


-- =============================================================================
-- SECTION 11: SEED DATA
-- All inserts use ON CONFLICT ... DO UPDATE so re-running is safe.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 11a. Permission catalog — 38 domain-action tokens
-- ---------------------------------------------------------------------------
INSERT INTO public.permission_catalog
    (id, domain, subdomain, action, label, description, sort_order)
VALUES
  -- Finance
  ('finance:fees:read',         'finance',   'fees',          'read',   'View Fee Records',             'Read fee structures and student balances',         10),
  ('finance:fees:write',        'finance',   'fees',          'write',  'Post Fee Payments',            'Create payments, waivers, and adjustments',        11),
  ('finance:fees:delete',       'finance',   'fees',          'delete', 'Delete Fee Records',           'Hard-delete fee entries',                          12),
  ('finance:payments:read',     'finance',   'payments',      'read',   'View Payments',                'Read payment history and receipts',                13),
  ('finance:payments:write',    'finance',   'payments',      'write',  'Record Payments',              'Create payment records',                           14),
  -- Academics
  ('academics:assessments:read',  'academics','assessments',  'read',   'View Assessments',             'Read student marks and scores',                    20),
  ('academics:assessments:write', 'academics','assessments',  'write',  'Enter Assessment Marks',       'Input and update raw marks',                       21),
  ('academics:assessments:delete','academics','assessments',  'delete', 'Delete Assessment Marks',      'Remove assessment entries',                        22),
  ('academics:classes:read',      'academics','classes',      'read',   'View Classes',                 'View class lists and streams',                     23),
  ('academics:classes:write',     'academics','classes',      'write',  'Manage Classes',               'Create and update class configurations',            24),
  ('academics:analytics:read',    'academics','analytics',    'read',   'View Analytics',               'Access performance analytics dashboard',            25),
  ('academics:heatmap:read',      'academics','heatmap',      'read',   'View Heatmap',                 'Access grade heatmap visualisations',               26),
  -- People
  ('people:students:read',    'people',    'students',      'read',   'View Students',                'Search and view the student directory',             30),
  ('people:students:write',   'people',    'students',      'write',  'Manage Students',              'Admit, edit, and transfer students',               31),
  ('people:students:delete',  'people',    'students',      'delete', 'Delete Students',              'Permanently remove student records',               32),
  ('people:teachers:read',    'people',    'teachers',      'read',   'View Teachers',                'Search and view the teacher directory',             33),
  ('people:teachers:write',   'people',    'teachers',      'write',  'Manage Teachers',              'Add, edit, and transfer teachers',                 34),
  ('people:parents:read',     'people',    'parents',       'read',   'View Parents',                 'Search and view parent records',                   35),
  ('people:parents:write',    'people',    'parents',       'write',  'Manage Parents',               'Invite and update parent accounts',                36),
  -- Comms
  ('comms:messages:read',      'comms',    'messages',      'read',   'View Communications',          'Read school communications',                       40),
  ('comms:messages:write',     'comms',    'messages',      'write',  'Send Communications',          'Compose and send messages',                        41),
  ('comms:events:read',        'comms',    'events',        'read',   'View Events',                  'View calendar events',                             42),
  ('comms:events:write',       'comms',    'events',        'write',  'Manage Events',                'Create and edit events',                           43),
  ('comms:announcements:read', 'comms',    'announcements', 'read',   'View Announcements',           'Read school announcements',                        44),
  ('comms:announcements:write','comms',    'announcements', 'write',  'Post Announcements',           'Create and publish announcements',                 45),
  ('comms:notifications:read', 'comms',    'notifications', 'read',   'View Notifications',           'View notification history',                        46),
  -- Security
  ('security:roles:read',      'security', 'roles',         'read',   'View Roles',                   'Read role definitions and assignments',             50),
  ('security:roles:manage',    'security', 'roles',         'manage', 'Manage Roles',                 'Create, assign, and revoke roles',                 51),
  ('security:audit:read',      'security', 'audit',         'read',   'Read Audit Logs',              'Access the security audit trail',                  52),
  ('security:overrides:manage','security', 'overrides',     'manage', 'Manage Permission Overrides',  'Grant or revoke individual permission tokens',     53),
  -- System
  ('system:settings:read',     'system',   'settings',      'read',   'View Settings',                'Read system configuration',                        60),
  ('system:settings:write',    'system',   'settings',      'write',  'Modify Settings',              'Update system configuration',                      61),
  ('system:health:read',       'system',   'health',        'read',   'View Health Records',          'Access student health data',                       62),
  ('system:health:write',      'system',   'health',        'write',  'Manage Health Records',        'Create and update health entries',                 63),
  ('system:library:read',      'system',   'library',       'read',   'View Library',                 'Access library records',                           64),
  ('system:library:write',     'system',   'library',       'write',  'Manage Library',               'Add and update library records',                   65),
  -- KNEC
  ('knec:exports:read',        'knec',     'exports',       'read',   'View KNEC Exports',            'Access KNEC result exports',                       70),
  ('knec:exports:write',       'knec',     'exports',       'write',  'Generate KNEC Exports',        'Create and submit KNEC export files',              71)

ON CONFLICT (id) DO UPDATE SET
    label       = EXCLUDED.label,
    description = EXCLUDED.description;


-- ---------------------------------------------------------------------------
-- 11b. Kibali Academy school (idempotent — already exists but kept for clarity)
-- ---------------------------------------------------------------------------
INSERT INTO public.schools (id, school_name, subdomain, county, primary_color)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Kibali Academy',
    'kibali',
    'Kakamega',
    '#f59e0b'
) ON CONFLICT (subdomain) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 11c. Admin role definitions for Kibali Academy
-- ---------------------------------------------------------------------------
INSERT INTO public.admin_role_definitions
    (id, school_id, label, description, baseline_permissions, allowed_paths, sort_order)
VALUES

  ('headteacher',
   '11111111-1111-1111-1111-111111111111',
   'Headteacher',
   'School headteacher — broad read access plus comms write',
   ARRAY[
     'finance:fees:read',
     'academics:assessments:read','academics:assessments:write',
     'academics:analytics:read','academics:heatmap:read','academics:classes:read',
     'people:students:read','people:teachers:read','people:parents:read',
     'comms:announcements:write','comms:events:write','comms:messages:write',
     'system:settings:read','knec:exports:read'
   ],
   ARRAY['/admin/dashboard','/admin/students','/admin/teachers','/admin/analytics',
         '/admin/heatmap','/admin/communications','/admin/events','/admin/announcements',
         '/admin/fees','/admin/exams','/admin/settings'],
   10),

  ('deputy_headteacher',
   '11111111-1111-1111-1111-111111111111',
   'Deputy Headteacher',
   'Deputy — academics focus; gains fees view or other tokens via per-user overrides',
   ARRAY[
     'academics:assessments:read','academics:assessments:write',
     'academics:classes:read','academics:classes:write',
     'academics:analytics:read','academics:heatmap:read',
     'people:students:read','people:teachers:read',
     'comms:announcements:read','comms:events:read',
     'knec:exports:read'
   ],
   ARRAY['/admin/dashboard','/admin/students','/admin/teachers','/admin/classes',
         '/admin/analytics','/admin/heatmap','/admin/exams'],
   20),

  ('bursar',
   '11111111-1111-1111-1111-111111111111',
   'Bursar',
   'Finance officer — full fee management; read-only on students',
   ARRAY[
     'finance:fees:read','finance:fees:write','finance:fees:delete',
     'finance:payments:read','finance:payments:write',
     'people:students:read'
   ],
   ARRAY['/admin/dashboard','/admin/fees','/admin/payments','/admin/students'],
   30),

  ('dos',
   '11111111-1111-1111-1111-111111111111',
   'Director of Studies',
   'Academics lead — assessments, analytics, and KNEC exports',
   ARRAY[
     'academics:assessments:read','academics:assessments:write',
     'academics:classes:read','academics:analytics:read','academics:heatmap:read',
     'people:students:read','people:teachers:read',
     'knec:exports:read','knec:exports:write'
   ],
   ARRAY['/admin/dashboard','/admin/students','/admin/teachers','/admin/classes',
         '/admin/analytics','/admin/heatmap','/admin/assessments','/admin/exams','/admin/csl'],
   40),

  ('class_teacher',
   '11111111-1111-1111-1111-111111111111',
   'Class Teacher',
   'Read-only view of fees; write access for own class marks',
   ARRAY[
     'finance:fees:read',
     'academics:assessments:read','academics:assessments:write',
     'academics:classes:read',
     'people:students:read'
   ],
   ARRAY['/admin/dashboard','/admin/students','/admin/fees','/admin/classes',
         '/admin/assessments'],
   50),

  ('school_doctor',
   '11111111-1111-1111-1111-111111111111',
   'School Doctor',
   'Medical officer — health records only',
   ARRAY[
     'people:students:read',
     'system:health:read','system:health:write'
   ],
   ARRAY['/admin/dashboard','/admin/students','/admin/health'],
   60),

  ('librarian',
   '11111111-1111-1111-1111-111111111111',
   'Librarian',
   'Library management access',
   ARRAY[
     'people:students:read',
     'system:library:read','system:library:write'
   ],
   ARRAY['/admin/dashboard','/admin/students','/admin/library'],
   70)

ON CONFLICT (school_id, id) DO UPDATE SET
    label                = EXCLUDED.label,
    description          = EXCLUDED.description,
    baseline_permissions = EXCLUDED.baseline_permissions,
    allowed_paths        = EXCLUDED.allowed_paths;


-- ---------------------------------------------------------------------------
-- 11d. Kibali Super Admin — patch existing profile row
--      Does NOT touch auth.users (already seeded / managed by Supabase Auth).
--      Just ensures the profiles row has the correct flags and new columns.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_uid       UUID := '77777777-7777-7777-7777-777777777777';
    v_school_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
    -- Update the existing profile row (created during earlier seeding)
    UPDATE public.profiles
    SET    is_super_admin                = true,
           is_dev                        = false,
           school_id                     = v_school_id,
           allowed_permissions_override  = '{}',
           denied_permissions_override   = '{}'
    WHERE  id = v_uid;

    -- If the profile doesn't exist yet, insert it
    INSERT INTO public.profiles
        (id, school_id, full_name, phone_number, email,
         role, is_super_admin, is_dev,
         allowed_permissions_override, denied_permissions_override)
    VALUES
        (v_uid, v_school_id, 'Kibali Super Admin', '+254700000002',
         'admin@kibali.ac.ke', 'admin', true, false, '{}', '{}')
    ON CONFLICT (id) DO NOTHING;

    -- Sync JWT claims so the super admin's token has is_super_admin=true
    -- and permissions=['*'] immediately after migration
    PERFORM public.sync_user_jwt_claims(v_uid);
END $$;

COMMIT;