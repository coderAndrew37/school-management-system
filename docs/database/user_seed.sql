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

DO $$
DECLARE
  -- ── CONFIGURE YOUR TEST VARIABLES HERE ──────────────────────────────────────
  target_school_id UUID := 'YOUR_ACTUAL_SCHOOL_ID_HERE'; -- <-- Double check this matches an actual school row
  test_user_id     UUID := gen_random_uuid();
  test_teacher_id  UUID := gen_random_uuid();
  test_email       TEXT := 'mwalimu.test@kibali.academy';
  test_phone       TEXT := '+254700000000';
  test_name        TEXT := 'Erick Mwalimu Omondi';
  tsc_ref          TEXT := 'TSC-998877';
BEGIN

  -- ── Step 1: Insert into Supabase Auth Identity Manager ─────────────────────
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    created_at,
    updated_at
  ) VALUES (
    test_user_id,
    '00000000-0000-0000-0000-000000000000',
    test_email,
    -- Password: "password123"
    '$2a$10$abcdefghijklmnopqrstuvwxyza1234567890abcdefghijklm',
    now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', test_name),
    false,
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  -- ── Step 2: Insert into Public Employment Directory ────────────────────────
  INSERT INTO public.teachers (
    id,
    school_id,
    tsc_number,
    status,
    invite_accepted,
    created_at
  ) VALUES (
    test_teacher_id,
    target_school_id,
    tsc_ref,
    'active',
    true,
    now()
  );

  -- ── Step 3: UPSERT into Public Profiles Matrix ─────────────────────────────
  -- Safely updates the profile row if Step 1 triggered an automatic background creation.
  INSERT INTO public.profiles (
    id,
    teacher_id,
    school_id,
    full_name,
    email,
    phone_number,
    role,
    base_role,
    roles,
    is_super_admin,
    is_dev,
    created_at,
    updated_at
  ) VALUES (
    test_user_id,
    test_teacher_id,
    target_school_id,
    test_name,
    test_email,
    test_phone,
    'teacher'::user_role,
    'teacher'::user_role,
    ARRAY['teacher'::user_role],
    false,
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    teacher_id = EXCLUDED.teacher_id,
    school_id = EXCLUDED.school_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone_number = EXCLUDED.phone_number,
    role = EXCLUDED.role,
    base_role = EXCLUDED.base_role,
    roles = EXCLUDED.roles,
    updated_at = now();

  RAISE NOTICE '✨ Seed Success with Upsert handling!';
  RAISE NOTICE 'User Auth ID: %', test_user_id;
  RAISE NOTICE 'Login Email: %', test_email;

END $$;