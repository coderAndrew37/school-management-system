-- =============================================================================
-- KIBALI ACADEMY — "Database error querying schema" DIAGNOSTIC
-- Run these checks IN ORDER. Each one narrows down the exact failure point.
-- "Success. No rows returned" on a DO block = the block ran without error ✅
-- =============================================================================

-- =============================================================================
-- DIAG 1: Find every trigger on auth.users
-- GoTrue errors during login almost always trace back to a trigger on auth.users
-- or a configured Auth Hook that runs under a restricted role.
-- =============================================================================

SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement,
    action_orientation
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table  = 'users'
ORDER BY trigger_name;

-- ❗ LOOK FOR: any trigger calling sync_user_jwt_claims, handle_new_user,
--             or any custom function. Write down every trigger name you see.
-- ✅ Standard Supabase triggers: on_auth_user_created (usually fine)
-- ❌ Custom triggers on auth.users: these are the likely culprit


-- =============================================================================
-- DIAG 2: Find every trigger on public.profiles
-- The trg_sync_profile_to_jwt trigger calls sync_user_jwt_claims.
-- If this fires during the login flow AND fails, it can cascade.
-- =============================================================================

SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table  = 'profiles'
ORDER BY trigger_name;

-- ✅ Expected:  profiles_updated_at (BEFORE UPDATE)
--              trg_sync_profile_to_jwt (AFTER UPDATE)
-- ❌ Any additional triggers here are suspicious


-- =============================================================================
-- DIAG 3: Check what the on_auth_user_created trigger function does
-- This is the standard Supabase trigger that creates profile rows.
-- If it references columns that no longer match, it fails on every signup/login.
-- =============================================================================

SELECT
    p.proname                          AS function_name,
    pg_get_functiondef(p.oid)          AS function_body
FROM pg_proc     p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname  = 'public'
  AND p.proname IN (
      'handle_new_user',
      'on_auth_user_created',
      'create_profile_for_user'
  );

-- ❗ READ the function body carefully.
-- Look for: INSERT INTO public.profiles (...)
-- If it inserts columns that no longer exist OR omits required NOT NULL columns,
-- it will fail on every new user creation AND potentially on re-login if
-- Supabase re-validates it.


-- =============================================================================
-- DIAG 4: Check privileges — can supabase_auth_admin see public tables?
-- "Database error querying schema" often means this role lacks SELECT.
-- =============================================================================

SELECT
    schemaname,
    tablename,
    has_table_privilege('supabase_auth_admin', schemaname || '.' || tablename, 'SELECT') AS can_select,
    has_table_privilege('supabase_auth_admin', schemaname || '.' || tablename, 'INSERT') AS can_insert,
    has_table_privilege('supabase_auth_admin', schemaname || '.' || tablename, 'UPDATE') AS can_update
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'profiles',
      'teachers',
      'schools',
      'staff_role_assignments',
      'admin_role_definitions',
      'permission_catalog'
  )
ORDER BY tablename;

-- ❌ If any can_select = false: that table is causing the schema query error.
-- Fix: GRANT SELECT ON public.<table> TO supabase_auth_admin;


-- =============================================================================
-- DIAG 5: Check privileges for authenticated role (used by RLS policies)
-- =============================================================================

SELECT
    tablename,
    has_table_privilege('authenticated', 'public.' || tablename, 'SELECT') AS can_select,
    has_table_privilege('authenticated', 'public.' || tablename, 'INSERT') AS can_insert,
    has_table_privilege('authenticated', 'public.' || tablename, 'UPDATE') AS can_update
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
      'profiles',
      'teachers',
      'students',
      'staff_role_assignments',
      'admin_role_definitions',
      'permission_catalog',
      'security_audit_logs'
  )
ORDER BY tablename;

-- ✅ All should be true (RLS policies control row-level access on top of this)
-- ❌ If any is false: GRANT SELECT/INSERT/UPDATE ON public.<table> TO authenticated;


-- =============================================================================
-- DIAG 6: Find Auth Hooks configured in the database
-- Auth Hooks run as supabase_auth_admin. If a hook calls our sync function
-- and that function fails under that role, we get the 500.
-- =============================================================================

-- Check if the auth.hooks table exists (Supabase added this in newer versions)
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth'
      AND table_name   = 'hooks'
) AS auth_hooks_table_exists;

-- If it exists, check what's registered:
SELECT *
FROM auth.hooks
LIMIT 20;

-- ❗ If any hook points to public.sync_user_jwt_claims, that's the issue.
-- Under supabase_auth_admin, the function may lack permission to run.
-- Fix: either remove the hook (JWT sync still happens via profile trigger)
--      or grant supabase_auth_admin execute + table access.


-- =============================================================================
-- DIAG 7: Test sync_user_jwt_claims under supabase_auth_admin role
-- This simulates exactly what happens when an Auth Hook calls our function.
-- =============================================================================

SET ROLE supabase_auth_admin;

DO $$
BEGIN
    PERFORM public.sync_user_jwt_claims('77777777-7777-7777-7777-777777777777');
    RAISE NOTICE 'sync_user_jwt_claims succeeded under supabase_auth_admin role';
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sync_user_jwt_claims FAILED under supabase_auth_admin: % (SQLSTATE: %)',
        SQLERRM, SQLSTATE;
END $$;

-- IMPORTANT: reset role after testing
RESET ROLE;

-- ❌ If WARNING fires: supabase_auth_admin cannot run our sync function.
--    This is the root cause. Fix is in schema-fix.sql (DIAG 8 below).
-- ✅ If NOTICE fires: the function runs fine under that role → hook is not the issue.


-- =============================================================================
-- DIAG 8: Check the handle_new_user function body (most common culprit)
-- Standard Supabase trigger. If it tries to insert columns that don't exist
-- or violates constraints, every login attempt that refreshes the session fails.
-- =============================================================================

SELECT pg_get_functiondef(oid)
FROM   pg_proc
WHERE  proname = 'handle_new_user'
  AND  pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ❗ Look for the INSERT INTO public.profiles statement.
-- Verify every column it inserts matches the current profiles schema exactly.
-- Common mismatches after our migration:
--   - Old trigger inserts `role` as text but column is an enum
--   - Old trigger doesn't set `full_name` which is now NOT NULL
--   - Old trigger sets columns that no longer exist


-- =============================================================================
-- DIAG 9: Simulate a brand-new user insert to test the profile trigger
-- This is the exact sequence GoTrue runs on signup/login session refresh.
-- =============================================================================

DO $$
DECLARE
    v_test_uid UUID := '99999999-9999-9999-9999-999999999999';
BEGIN
    -- Step 1: Insert into auth.users (simulating GoTrue)
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_test_uid,
        'authenticated', 'authenticated',
        'test_diag_user@kibali.test',
        '',
        NOW(),
        '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Diagnostic Test User"}',
        NOW(), NOW(), ''
    );

    RAISE NOTICE 'Step 1 OK: auth.users insert succeeded';

    -- Step 2: Check if the profile trigger created a profile row
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_test_uid) THEN
        RAISE NOTICE 'Step 2 OK: profile row was auto-created by trigger';
    ELSE
        RAISE WARNING 'Step 2 FAILED: no profile row was created — handle_new_user trigger is broken';
    END IF;

    -- Cleanup
    DELETE FROM auth.users   WHERE id = v_test_uid;
    DELETE FROM public.profiles WHERE id = v_test_uid;

    RAISE NOTICE 'Cleanup complete. Diagnostic test finished.';

EXCEPTION WHEN OTHERS THEN
    -- Cleanup on failure
    DELETE FROM auth.users   WHERE id = v_test_uid;
    DELETE FROM public.profiles WHERE id = v_test_uid;

    RAISE WARNING 'DIAG 9 FAILED at: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;

-- ❌ If DIAG 9 WARNING fires: the handle_new_user trigger is the root cause.
--    The SQLSTATE will tell you exactly why:
--      23502 = not_null_violation (required column not set)
--      23505 = unique_violation (duplicate email or phone)
--      42703 = undefined_column (trigger references a column that doesn't exist)
--      42501 = insufficient_privilege (permission issue)