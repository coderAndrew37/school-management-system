-- ============================================================
-- CREATE SUPERADMIN USER
-- Kibali Academy CBC School Management System
--
-- This user has all three roles: admin, teacher, parent.
-- The `role` column (singular) is the PRIMARY role used by
-- all RLS policies (is_admin(), is_teacher(), etc.).
-- The `roles` array column stores ALL roles for the UI to
-- show the appropriate menus/permissions.
--
-- HOW TO RUN:
--   1. Run the entire script in the Supabase SQL editor.
--   2. The user will be created in auth.users directly using
--      the service role (which the SQL editor has access to).
--   3. Change the email/password/name below before running.
-- ============================================================

DO $$
DECLARE
  v_user_id   UUID;
  v_email     TEXT    := 'devandrew66@gmail.com';     -- CHANGE THIS
  v_password  TEXT    := '@_SytemDeveloper@AJ!';      -- CHANGE THIS
  v_full_name TEXT    := 'System Developer';   -- CHANGE THIS
BEGIN

  -- ── STEP 1: Create the auth.users entry ──────────────────────────────────
  -- We call Supabase's internal auth function directly.
  -- This is only possible from the SQL editor (service role context).

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  )
  VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    crypt(v_password, gen_salt('bf')),   -- bcrypt hash
    NOW(),                                -- email pre-confirmed
    jsonb_build_object(
      'full_name', v_full_name,
      'role',      'admin'
    ),
    'authenticated',
    'authenticated',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO v_user_id;

  RAISE NOTICE 'Created auth user: % (id: %)', v_email, v_user_id;

  -- ── STEP 2: The handle_new_user() trigger fires automatically and creates
  --            a profiles row with role = 'admin' (from raw_user_meta_data).
  --            We now UPDATE it to also fill the roles[] array and full_name.

  UPDATE profiles
  SET
    role      = 'admin',                                    -- primary role for RLS
    roles     = ARRAY['admin', 'teacher', 'parent']::user_role[],  -- all roles for UI
    full_name = v_full_name
  WHERE id = v_user_id;

  RAISE NOTICE 'Profile updated for % — roles: admin, teacher, parent', v_full_name;

  -- ── STEP 3: Verify ───────────────────────────────────────────────────────
  PERFORM id FROM profiles
  WHERE id = v_user_id
    AND role = 'admin'
    AND 'admin'   = ANY(roles)
    AND 'teacher' = ANY(roles)
    AND 'parent'  = ANY(roles);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile verification failed — check the profiles table manually.';
  END IF;

  RAISE NOTICE '✓ Superadmin created successfully. Email: %, Password: %', v_email, v_password;

END $$;

-- ============================================================
-- VERIFY — should return 1 row with all three roles
-- ============================================================

SELECT
  u.email,
  p.full_name,
  p.role        AS primary_role,
  p.roles       AS all_roles,
  p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'admin'
ORDER BY p.created_at DESC
LIMIT 5;