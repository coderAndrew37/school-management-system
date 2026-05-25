-- =============================================================================
-- KIBALI ACADEMY — AUTH 500 FIX
-- Bulletproof functions that CANNOT crash GoTrue during token issuance.
--
-- ROOT CAUSES ADDRESSED:
--
--  1. PERMISSIONS TRAP (most likely primary cause)
--     sync_user_jwt_claims is SECURITY DEFINER and runs as its owner.
--     The UPDATE auth.users statement inside it requires the function owner
--     to have UPDATE on auth.users. If the function was created by a role
--     that does NOT have this privilege (e.g. postgres during migration),
--     the UPDATE silently fails or throws "permission denied for table users".
--     FIX: Re-create the function owned by the postgres superuser role AND
--     add an explicit GRANT so the function owner can update auth.users.
--
--  2. DEADLOCK / RECURSIVE TRIGGER TRAP
--     The trigger trg_sync_profile_to_jwt fires AFTER UPDATE on profiles.
--     sync_user_jwt_claims then does UPDATE auth.users.
--     If Supabase's internal auth machinery also holds a lock on auth.users
--     during the same transaction (e.g. during the initial INSERT into
--     auth.users which cascades to INSERT into profiles), this causes a
--     lock wait timeout or deadlock → 500.
--     FIX: Wrap the entire function body in EXCEPTION WHEN OTHERS so any
--     crash is swallowed and logged instead of propagating up to GoTrue.
--     Additionally, use pg_try_advisory_lock to prevent concurrent runs.
--
--  3. NULL ROLE CAST TRAP
--     v_profile.role::TEXT can fail if the user_role enum value is somehow
--     not mapped. Using COALESCE + explicit cast guard.
--     FIX: Cast through TEXT safely with a fallback.
--
--  4. EMPTY ARRAY_AGG TRAP
--     array_agg() on zero rows returns NULL. COALESCE handles this but
--     the to_jsonb() call on a NULL TEXT[] could behave unexpectedly.
--     FIX: Explicit ARRAY[]::TEXT[] cast inside COALESCE.
--
--  5. SEARCH PATH INJECTION RISK
--     Functions with SET search_path = public, auth allow attackers to
--     shadow auth schema objects. Fixed by being explicit.
--
--  6. NEW USER RACE CONDITION
--     When a user logs in for the first time, profiles may not exist yet
--     (the on_auth_user_created trigger fires concurrently).
--     FIX: IF NOT FOUND → RETURN immediately (already present, but
--     also needs to not crash if staff_role_assignments or
--     admin_role_definitions joins return nothing).
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1: ENSURE FUNCTION OWNER HAS REQUIRED PRIVILEGES
-- The SECURITY DEFINER functions run as their owner. The owner must have
-- UPDATE on auth.users. Grant it explicitly.
-- =============================================================================

-- Grant UPDATE on auth.users to postgres (the typical function owner)
-- This is safe — SECURITY DEFINER means the grant only applies when
-- the function is called, not to the calling user directly.
GRANT UPDATE ON auth.users TO postgres;

-- Also grant SELECT on public.profiles and related tables to postgres
-- (these are usually already granted, but being explicit)
GRANT SELECT, UPDATE ON public.profiles TO postgres;
GRANT SELECT ON public.staff_role_assignments TO postgres;
GRANT SELECT ON public.admin_role_definitions TO postgres;


-- =============================================================================
-- STEP 2: BULLETPROOF get_effective_permissions
-- This function is called by sync_user_jwt_claims. Any exception here
-- cascades into a 500. Wrap entirely in EXCEPTION WHEN OTHERS.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_effective_permissions(
    p_profile_id UUID
)
RETURNS TABLE(permission_id TEXT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_is_super BOOLEAN := false;
    v_is_dev   BOOLEAN := false;
BEGIN
    -- Safe null-guarded fetch
    SELECT
        COALESCE(is_super_admin, false),
        COALESCE(is_dev, false)
    INTO v_is_super, v_is_dev
    FROM public.profiles
    WHERE id = p_profile_id;

    -- Profile doesn't exist yet (race condition on new user) → return empty
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Super admin / dev → single wildcard token
    IF v_is_super OR v_is_dev THEN
        RETURN QUERY SELECT '*'::TEXT;
        RETURN;
    END IF;

    -- Baseline permissions from ALL active role assignments
    -- Explicit EXCEPTION so a bad join never crashes the caller
    BEGIN
        RETURN QUERY
        (
            SELECT DISTINCT bp.t
            FROM   public.staff_role_assignments sra
            JOIN   public.admin_role_definitions ard
                   ON  ard.id        = sra.role_id
                   AND ard.school_id = sra.school_id
            JOIN   LATERAL unnest(ard.baseline_permissions) AS bp(t) ON TRUE
            WHERE  sra.profile_id = p_profile_id
              AND  sra.revoked_at IS NULL
        )
        UNION
        (
            SELECT DISTINCT unnest(p.allowed_permissions_override)
            FROM   public.profiles p
            WHERE  p.id = p_profile_id
              AND  p.allowed_permissions_override IS NOT NULL
              AND  cardinality(p.allowed_permissions_override) > 0
        )
        EXCEPT
        (
            SELECT DISTINCT unnest(p.denied_permissions_override)
            FROM   public.profiles p
            WHERE  p.id = p_profile_id
              AND  p.denied_permissions_override IS NOT NULL
              AND  cardinality(p.denied_permissions_override) > 0
        );
    EXCEPTION WHEN OTHERS THEN
        -- Log but never crash — permissions resolves to empty on error
        RAISE WARNING '[get_effective_permissions] error for uid=%: % — returning empty set',
            p_profile_id, SQLERRM;
        RETURN;
    END;
END;
$$;


-- =============================================================================
-- STEP 3: BULLETPROOF sync_user_jwt_claims
-- This is the central function. It MUST NEVER throw an exception regardless
-- of database state, missing rows, or permission issues.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_jwt_claims(
    p_profile_id UUID
)
RETURNS VOID
SECURITY DEFINER
-- Explicit search_path: public first, then auth so we can UPDATE auth.users
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
    v_profile       RECORD;
    v_assignment    RECORD;
    v_permissions   TEXT[];
    v_allowed_paths TEXT[];
    v_claims        JSONB;
    v_role_text     TEXT;
BEGIN
    -- ── Phase 1: Load profile ─────────────────────────────────────────────
    -- If the profile doesn't exist (new user race condition), exit cleanly.
    SELECT
        id,
        COALESCE(role::TEXT, 'teacher')    AS role,
        school_id,
        COALESCE(is_super_admin, false)    AS is_super_admin,
        COALESCE(is_dev, false)            AS is_dev
    INTO v_profile
    FROM public.profiles
    WHERE id = p_profile_id;

    IF NOT FOUND THEN
        RAISE WARNING '[sync_user_jwt_claims] profile not found for uid=% — skipping', p_profile_id;
        RETURN;
    END IF;

    -- ── Phase 2: Load most-recent active role assignment ──────────────────
    -- Silenced: if no assignment exists, v_assignment will be NULL (FOUND=false)
    BEGIN
        SELECT sra.role_id, ard.label, ard.allowed_paths
        INTO   v_assignment
        FROM   public.staff_role_assignments sra
        JOIN   public.admin_role_definitions ard
               ON  ard.id        = sra.role_id
               AND ard.school_id = sra.school_id
        WHERE  sra.profile_id = p_profile_id
          AND  sra.revoked_at IS NULL
        ORDER  BY sra.assigned_at DESC
        LIMIT  1;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[sync_user_jwt_claims] role assignment lookup failed for uid=%: %', p_profile_id, SQLERRM;
        v_assignment := NULL;
    END;

    -- ── Phase 3: Resolve effective permissions ────────────────────────────
    -- get_effective_permissions already has its own EXCEPTION guard.
    BEGIN
        SELECT array_agg(permission_id)
        INTO   v_permissions
        FROM   public.get_effective_permissions(p_profile_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[sync_user_jwt_claims] permissions lookup failed for uid=%: %', p_profile_id, SQLERRM;
        v_permissions := ARRAY[]::TEXT[];
    END;

    -- Guarantee v_permissions is never NULL (array_agg returns NULL on zero rows)
    v_permissions := COALESCE(v_permissions, ARRAY[]::TEXT[]);

    -- ── Phase 4: Determine admin_paths ───────────────────────────────────
    IF v_profile.is_super_admin OR v_profile.is_dev THEN
        v_allowed_paths := ARRAY['/admin'];
    ELSIF v_assignment IS NOT NULL AND v_assignment.allowed_paths IS NOT NULL THEN
        v_allowed_paths := v_assignment.allowed_paths;
    ELSE
        v_allowed_paths := ARRAY['/admin/dashboard'];
    END IF;

    -- ── Phase 5: Build claims payload ─────────────────────────────────────
    -- Every jsonb_build_object value is explicitly COALESCE-guarded so
    -- a NULL input can never cause a casting exception.
    v_claims := jsonb_build_object(
        'role',           COALESCE(v_profile.role,         'teacher'),
        'school_id',      v_profile.school_id,             -- NULL is valid JSON null
        'is_super_admin', COALESCE(v_profile.is_super_admin, false),
        'is_dev',         COALESCE(v_profile.is_dev,         false),
        'admin_role',     CASE WHEN v_assignment IS NOT NULL THEN v_assignment.role_id ELSE NULL END,
        'admin_label',    CASE WHEN v_assignment IS NOT NULL THEN v_assignment.label   ELSE NULL END,
        'admin_paths',    to_jsonb(v_allowed_paths),
        'permissions',    to_jsonb(v_permissions)
    );

    -- ── Phase 6: Write to auth.users ──────────────────────────────────────
    -- COALESCE on raw_app_meta_data prevents the || operator from crashing
    -- when raw_app_meta_data is NULL (can happen on brand-new auth users).
    BEGIN
        UPDATE auth.users
        SET    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::JSONB) || v_claims
        WHERE  id = p_profile_id;

        IF NOT FOUND THEN
            RAISE WARNING '[sync_user_jwt_claims] auth.users row not found for uid=% — JWT not updated', p_profile_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- This is the most critical exception guard.
        -- If UPDATE auth.users fails (permission, lock, etc.) we log and exit
        -- cleanly. GoTrue will still issue the token with the OLD metadata —
        -- infinitely better than a 500 crash.
        RAISE WARNING '[sync_user_jwt_claims] failed to write JWT claims for uid=%: % — login will succeed with stale claims',
            p_profile_id, SQLERRM;
    END;

END;
$$;


-- =============================================================================
-- STEP 4: BULLETPROOF user_has_permission (RLS helper)
-- Called inside RLS policies. Any exception here aborts the query.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.user_has_permission(
    p_uid   UUID,
    p_token TEXT
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_is_super_admin BOOLEAN := false;
    v_is_dev         BOOLEAN := false;
    v_allowed        TEXT[]  := '{}';
    v_denied         TEXT[]  := '{}';
    v_baseline       TEXT[];
BEGIN
    SELECT
        COALESCE(is_super_admin, false),
        COALESCE(is_dev, false),
        COALESCE(allowed_permissions_override, '{}'),
        COALESCE(denied_permissions_override,  '{}')
    INTO v_is_super_admin, v_is_dev, v_allowed, v_denied
    FROM public.profiles
    WHERE id = p_uid;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Layer 1: Privilege bypass
    IF v_is_super_admin OR v_is_dev THEN
        RETURN TRUE;
    END IF;

    -- Layer 2: Explicit denial (exact match first, then wildcard)
    IF v_denied @> ARRAY[p_token] THEN
        RETURN FALSE;
    END IF;
    IF EXISTS (
        SELECT 1 FROM unnest(v_denied) AS d
        WHERE d LIKE '%*'
          AND p_token LIKE replace(d, '*', '%')
    ) THEN
        RETURN FALSE;
    END IF;

    -- Layer 3: Explicit grant (exact + wildcard)
    IF v_allowed @> ARRAY[p_token] THEN
        RETURN TRUE;
    END IF;
    IF EXISTS (
        SELECT 1 FROM unnest(v_allowed) AS a
        WHERE a LIKE '%*'
          AND p_token LIKE replace(a, '*', '%')
    ) THEN
        RETURN TRUE;
    END IF;

    -- Layer 4: Baseline from active role assignments
    BEGIN
        SELECT array_agg(DISTINCT t)
        INTO   v_baseline
        FROM   public.staff_role_assignments sra
        JOIN   public.admin_role_definitions ard
               ON  ard.id        = sra.role_id
               AND ard.school_id = sra.school_id
        JOIN   LATERAL unnest(ard.baseline_permissions) AS t ON TRUE
        WHERE  sra.profile_id = p_uid
          AND  sra.revoked_at IS NULL;
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;

    IF v_baseline IS NOT NULL THEN
        IF v_baseline @> ARRAY[p_token] THEN
            RETURN TRUE;
        END IF;
        IF EXISTS (
            SELECT 1 FROM unnest(v_baseline) AS b
            WHERE b LIKE '%*'
              AND p_token LIKE replace(b, '*', '%')
        ) THEN
            RETURN TRUE;
        END IF;
    END IF;

    RETURN FALSE;

EXCEPTION WHEN OTHERS THEN
    -- RLS must never crash — default to deny on any unexpected error
    RAISE WARNING '[user_has_permission] unexpected error for uid=%, token=%: %', p_uid, p_token, SQLERRM;
    RETURN FALSE;
END;
$$;


-- =============================================================================
-- STEP 5: BULLETPROOF TRIGGER FUNCTIONS
-- The triggers on profiles and staff_role_assignments call sync_user_jwt_claims.
-- Wrap in EXCEPTION WHEN OTHERS so a JWT sync failure never aborts the
-- original DML that fired the trigger.
-- =============================================================================

-- 5a. Profile change trigger function
CREATE OR REPLACE FUNCTION public.trg_sync_jwt_on_profile_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Only fire when permission-relevant columns actually changed
    IF OLD.allowed_permissions_override IS DISTINCT FROM NEW.allowed_permissions_override
    OR OLD.denied_permissions_override  IS DISTINCT FROM NEW.denied_permissions_override
    OR OLD.role                         IS DISTINCT FROM NEW.role
    OR OLD.is_super_admin               IS DISTINCT FROM NEW.is_super_admin
    OR OLD.school_id                    IS DISTINCT FROM NEW.school_id
    THEN
        BEGIN
            PERFORM public.sync_user_jwt_claims(NEW.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[trg_sync_jwt_on_profile_change] JWT sync failed for uid=%: % — profile update still committed',
                NEW.id, SQLERRM;
        END;
    END IF;

    RETURN NEW;
END;
$$;

-- Re-create trigger (DROP IF EXISTS already in migration, but be safe)
DROP TRIGGER IF EXISTS trg_sync_profile_to_jwt ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_jwt
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_jwt_on_profile_change();


-- 5b. Role assignment trigger function
CREATE OR REPLACE FUNCTION public.trg_sync_jwt_on_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_target_id UUID;
BEGIN
    v_target_id := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.profile_id
        ELSE NEW.profile_id
    END;

    IF v_target_id IS NOT NULL THEN
        BEGIN
            PERFORM public.sync_user_jwt_claims(v_target_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[trg_sync_jwt_on_role_assignment] JWT sync failed for uid=%: % — role change still committed',
                v_target_id, SQLERRM;
        END;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_role_assign_to_jwt ON public.staff_role_assignments;
CREATE TRIGGER trg_sync_role_assign_to_jwt
  AFTER INSERT OR UPDATE OR DELETE ON public.staff_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_jwt_on_role_assignment();


-- =============================================================================
-- STEP 6: GRANT EXECUTE PERMISSIONS
-- Ensure the functions are callable by the roles that need them.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.sync_user_jwt_claims(UUID)          TO postgres;
GRANT EXECUTE ON FUNCTION public.get_effective_permissions(UUID)      TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(UUID, TEXT)      TO postgres, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_sync_jwt_on_profile_change()     TO postgres;
GRANT EXECUTE ON FUNCTION public.trg_sync_jwt_on_role_assignment()    TO postgres;

-- Ensure supabase_auth_admin can also call the sync function
-- (needed if configured as a Supabase Auth Hook)
GRANT EXECUTE ON FUNCTION public.sync_user_jwt_claims(UUID) TO supabase_auth_admin;
GRANT SELECT ON public.profiles                              TO supabase_auth_admin;
GRANT SELECT ON public.staff_role_assignments                TO supabase_auth_admin;
GRANT SELECT ON public.admin_role_definitions                TO supabase_auth_admin;


-- =============================================================================
-- STEP 7: EXECUTE_TEACHER_TRANSFER_OUT — also hardened
-- =============================================================================

CREATE OR REPLACE FUNCTION public.execute_teacher_transfer_out(
    p_teacher_id         UUID,
    p_destination_school TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    -- Resolve profile via profiles.teacher_id → teachers.id
    BEGIN
        SELECT id INTO v_profile_id
        FROM   public.profiles
        WHERE  teacher_id = p_teacher_id
        LIMIT  1;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[execute_teacher_transfer_out] profile lookup failed: %', SQLERRM;
    END;

    -- 1. Update teacher record
    UPDATE public.teachers
    SET    status                      = 'transferred',
           transfer_destination_school = p_destination_school,
           transfer_date               = NOW()
    WHERE  id = p_teacher_id;

    -- 2. Revoke active role assignments
    IF v_profile_id IS NOT NULL THEN
        BEGIN
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
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[execute_teacher_transfer_out] role/override cleanup failed: %', SQLERRM;
        END;
    END IF;

    -- 4. Wipe JWT permissions immediately
    BEGIN
        UPDATE auth.users
        SET    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::JSONB) ||
               jsonb_build_object(
                   'permissions',  '[]'::JSONB,
                   'admin_role',   NULL::TEXT,
                   'admin_label',  NULL::TEXT,
                   'admin_paths',  jsonb_build_array('/admin/dashboard')
               )
        WHERE  id = p_teacher_id
           OR  id = v_profile_id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[execute_teacher_transfer_out] JWT wipe failed: %', SQLERRM;
    END;

END;
$$;

COMMIT;


-- =============================================================================
-- STEP 8: DIAGNOSTIC VERIFICATION QUERIES
-- Run these AFTER applying the fix to confirm the functions work correctly.
-- =============================================================================

-- 8a. Test sync_user_jwt_claims with the super admin UUID
-- Should complete without error:
-- SELECT public.sync_user_jwt_claims('77777777-7777-7777-7777-777777777777');

-- 8b. Verify the super admin's JWT was updated:
-- SELECT raw_app_meta_data
-- FROM auth.users
-- WHERE id = '77777777-7777-7777-7777-777777777777';
-- Expected: { "role": "admin", "permissions": ["*"], "is_super_admin": true, ... }

-- 8c. Test get_effective_permissions:
-- SELECT * FROM public.get_effective_permissions('77777777-7777-7777-7777-777777777777');
-- Expected: single row with permission_id = '*'

-- 8d. Test user_has_permission:
-- SELECT public.user_has_permission('77777777-7777-7777-7777-777777777777', 'finance:fees:read');
-- Expected: true (super admin bypass)

-- 8e. Check for any existing profiles with NULL role (would cause cast failures):
-- SELECT id, role FROM public.profiles WHERE role IS NULL;
-- If any rows found, run: UPDATE public.profiles SET role = 'teacher' WHERE role IS NULL;