-- =============================================================================
-- KIBALI ACADEMY — AUTH 500 DIAGNOSTIC CHECKLIST & VERIFICATION
-- Run these queries in the Supabase SQL editor AFTER applying auth-500-fix.sql
-- Work through them top to bottom in order.
-- =============================================================================

-- =============================================================================
-- CHECK 1: Confirm the FUNCTION OWNER has UPDATE on auth.users
-- If this returns false, the sync function silently fails every login.
-- =============================================================================

SELECT
    p.proname                          AS function_name,
    r.rolname                          AS owner,
    has_table_privilege(r.oid, 'auth.users', 'UPDATE') AS can_update_auth_users
FROM   pg_proc     p
JOIN   pg_authid   r ON r.oid = p.proowner
WHERE  p.proname IN (
    'sync_user_jwt_claims',
    'get_effective_permissions',
    'user_has_permission',
    'execute_teacher_transfer_out'
)
AND    p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ✅ Expected: can_update_auth_users = true for sync_user_jwt_claims
-- ❌ If false: run  GRANT UPDATE ON auth.users TO <owner_role>;


-- =============================================================================
-- CHECK 2: Confirm SECURITY DEFINER + search_path on all critical functions
-- =============================================================================

SELECT
    p.proname                                       AS function_name,
    p.prosecdef                                     AS is_security_definer,
    p.proconfig                                     AS config_settings
FROM   pg_proc p
WHERE  p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND    p.proname IN (
    'sync_user_jwt_claims',
    'get_effective_permissions',
    'user_has_permission',
    'trg_sync_jwt_on_profile_change',
    'trg_sync_jwt_on_role_assignment',
    'execute_teacher_transfer_out'
);

-- ✅ Expected: is_security_definer = true for ALL rows
-- ✅ Expected: config_settings contains 'search_path=public,auth' or 'search_path=public'
-- ❌ If is_security_definer = false: re-run auth-500-fix.sql


-- =============================================================================
-- CHECK 3: Verify the super admin profile exists and has correct shape
-- =============================================================================

SELECT
    id,
    role,
    is_super_admin,
    is_dev,
    school_id,
    COALESCE(array_length(allowed_permissions_override, 1), 0) AS allowed_count,
    COALESCE(array_length(denied_permissions_override,  1), 0) AS denied_count,
    email
FROM public.profiles
WHERE id = '77777777-7777-7777-7777-777777777777';

-- ✅ Expected: role='admin', is_super_admin=true, school_id NOT NULL
-- ❌ If no rows: the super admin profile was not seeded → run Section 11d of migration.sql
-- ❌ If role IS NULL: run UPDATE public.profiles SET role = 'admin' WHERE id = '77777777-7777-7777-7777-777777777777';


-- =============================================================================
-- CHECK 4: Verify auth.users row exists and has app_metadata
-- =============================================================================

SELECT
    id,
    email,
    raw_app_meta_data,
    created_at
FROM auth.users
WHERE id = '77777777-7777-7777-7777-777777777777';

-- ✅ Expected: raw_app_meta_data contains role, permissions, is_super_admin
-- ❌ If raw_app_meta_data is NULL or {}: manually run the sync:
--    SELECT public.sync_user_jwt_claims('77777777-7777-7777-7777-777777777777');
-- ❌ If no rows: the auth user was not seeded → insert via Supabase Dashboard or re-run seed


-- =============================================================================
-- CHECK 5: Test sync_user_jwt_claims directly
-- This is the function called during/after login. If it throws here, it will
-- throw during login too.
-- =============================================================================

-- Run the sync for the super admin:
SELECT public.sync_user_jwt_claims('77777777-7777-7777-7777-777777777777');

-- Then verify the result:
SELECT
    raw_app_meta_data -> 'role'           AS role,
    raw_app_meta_data -> 'permissions'    AS permissions,
    raw_app_meta_data -> 'is_super_admin' AS is_super_admin,
    raw_app_meta_data -> 'school_id'      AS school_id,
    raw_app_meta_data -> 'admin_paths'    AS admin_paths
FROM auth.users
WHERE id = '77777777-7777-7777-7777-777777777777';

-- ✅ Expected:
--   role           = "admin"
--   permissions    = ["*"]
--   is_super_admin = true
--   school_id      = "11111111-1111-1111-1111-111111111111"
--   admin_paths    = ["/admin"]


-- =============================================================================
-- CHECK 6: Test get_effective_permissions
-- =============================================================================

SELECT permission_id
FROM public.get_effective_permissions('77777777-7777-7777-7777-777777777777');

-- ✅ Expected: single row with permission_id = '*'
-- ❌ If throws: there is still a crash in the function — check Postgres logs
--   via Supabase Dashboard → Logs → Postgres


-- =============================================================================
-- CHECK 7: Test user_has_permission (used in RLS policies)
-- =============================================================================

SELECT
    public.user_has_permission('77777777-7777-7777-7777-777777777777', 'finance:fees:read')   AS can_read_fees,
    public.user_has_permission('77777777-7777-7777-7777-777777777777', 'security:roles:manage') AS can_manage_roles,
    public.user_has_permission('77777777-7777-7777-7777-777777777777', 'people:students:write') AS can_write_students;

-- ✅ Expected: all three = true (super admin bypass)


-- =============================================================================
-- CHECK 8: Confirm no profiles rows have NULL role (would crash the enum cast)
-- =============================================================================

SELECT COUNT(*) AS null_role_count
FROM public.profiles
WHERE role IS NULL;

-- ✅ Expected: 0
-- ❌ If > 0: run the fix below, then re-run CHECK 8

-- FIX for NULL roles:
UPDATE public.profiles
SET    role = 'teacher'
WHERE  role IS NULL;


-- =============================================================================
-- CHECK 9: Confirm triggers are correctly wired
-- =============================================================================

SELECT
    trigger_name,
    event_object_table  AS table_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND   trigger_name IN (
    'trg_sync_profile_to_jwt',
    'trg_sync_role_assign_to_jwt',
    'profiles_updated_at'
)
ORDER BY table_name, trigger_name;

-- ✅ Expected rows:
--   trg_sync_profile_to_jwt    on profiles              AFTER  UPDATE
--   trg_sync_role_assign_to_jwt on staff_role_assignments AFTER INSERT/UPDATE/DELETE
--   profiles_updated_at        on profiles              BEFORE UPDATE

-- ❌ If trg_sync_profile_to_jwt is missing: the trigger drop/create in
--    auth-500-fix.sql did not run — re-run STEP 5 of auth-500-fix.sql


-- =============================================================================
-- CHECK 10: Confirm no Supabase Auth Hook is configured pointing to a
--           function that could throw. Auth Hooks are configured in:
--           Supabase Dashboard → Authentication → Hooks
--
-- If a Custom Auth Hook is configured that calls sync_user_jwt_claims,
-- and that function throws, GoTrue returns 500 BEFORE issuing the token.
-- After applying auth-500-fix.sql, the function is now exception-safe.
-- But if NO auth hook is needed, removing it eliminates the risk entirely.
--
-- This is a DASHBOARD check — cannot be done via SQL.
-- Go to: Dashboard → Authentication → Hooks
-- If you see a hook pointing to public.sync_user_jwt_claims, either:
--   a) Keep it — it is now exception-safe after the fix
--   b) Remove it — JWT sync will still happen via the profile UPDATE trigger
-- =============================================================================

-- Informational only — check if any hooks exist in the DB:
SELECT *
FROM   auth.hooks
LIMIT  10;

-- ✅ Expected: 0 rows (no custom auth hooks), OR rows that point to
--    public.sync_user_jwt_claims (which is now exception-safe)


-- =============================================================================
-- CHECK 11: Simulate a login flow — the full trigger chain
-- This manually fires the same sequence of events that happen on login.
-- =============================================================================

DO $$
DECLARE
    v_uid UUID := '77777777-7777-7777-7777-777777777777';
BEGIN
    RAISE NOTICE 'Step 1: Testing get_effective_permissions...';
    PERFORM public.get_effective_permissions(v_uid);
    RAISE NOTICE 'Step 1: OK';

    RAISE NOTICE 'Step 2: Testing sync_user_jwt_claims...';
    PERFORM public.sync_user_jwt_claims(v_uid);
    RAISE NOTICE 'Step 2: OK';

    RAISE NOTICE 'Step 3: Verifying auth.users was updated...';
    IF EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = v_uid
          AND raw_app_meta_data ? 'permissions'
    ) THEN
        RAISE NOTICE 'Step 3: OK — permissions key present in JWT';
    ELSE
        RAISE WARNING 'Step 3: FAILED — permissions key missing from JWT';
    END IF;

    RAISE NOTICE 'All checks passed. Login should work.';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'SIMULATION FAILED: % — SQLSTATE: %', SQLERRM, SQLSTATE;
END $$;

-- ✅ Expected: NOTICE messages ending with "All checks passed"
-- ❌ If WARNING fires: the SQLSTATE tells you exactly what went wrong


-- =============================================================================
-- CHECK 12: Force-sync ALL existing admin profiles
-- After applying the fix, bring all existing users' JWTs up to date.
-- =============================================================================

DO $$
DECLARE
    v_profile RECORD;
    v_count   INTEGER := 0;
    v_errors  INTEGER := 0;
BEGIN
    FOR v_profile IN
        SELECT id FROM public.profiles WHERE role = 'admin'
    LOOP
        BEGIN
            PERFORM public.sync_user_jwt_claims(v_profile.id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'sync failed for uid=%: %', v_profile.id, SQLERRM;
            v_errors := v_errors + 1;
        END;
    END LOOP;

    RAISE NOTICE 'JWT sync complete: % succeeded, % failed', v_count, v_errors;
END $$;

-- ✅ Expected: "JWT sync complete: N succeeded, 0 failed"