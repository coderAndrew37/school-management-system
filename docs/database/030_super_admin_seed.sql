BEGIN;

-- ==========================================
-- STEP 1: CLEAN SLATE (WIPE DEMO DATA)
-- ==========================================
TRUNCATE TABLE public.student_parents CASCADE;
TRUNCATE TABLE public.students CASCADE;
TRUNCATE TABLE public.profiles CASCADE;
DROP TABLE IF EXISTS public.parents CASCADE;

-- Safely clear out ONLY the school admin email so it re-seeds perfectly
DELETE FROM auth.users WHERE email = 'admin@kibali.ac.ke';

-- ==========================================
-- STEP 2: CREATE THE MULTI-TENANT BACKBONE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    county TEXT NOT NULL,
    primary_color VARCHAR(7) DEFAULT '#000000' NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seed Kibali Academy as the primary tenant
INSERT INTO public.schools (id, school_name, subdomain, county, primary_color)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    'Kibali Academy', 
    'kibali', 
    'Kakamega', 
    '#0044ff'
)
ON CONFLICT (subdomain) DO NOTHING;

-- ==========================================
-- STEP 3: MORPH TABLES WITH TENANT-SCOPED CONSTRAINTS
-- ==========================================

-- 1. Upgrade Students Table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.students ALTER COLUMN readable_id SET NOT NULL;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_readable_id_key;
ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_school_readable_unique;
ALTER TABLE public.students ADD CONSTRAINT students_school_readable_unique UNIQUE (school_id, readable_id);

-- 2. Upgrade Profiles Table (Dev Team + School Super Admin Support)
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
DROP TRIGGER IF EXISTS trg_sync_profile_roles ON public.profiles;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_dev BOOLEAN DEFAULT false NOT NULL;          -- For Us (Dev Team)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false NOT NULL;  -- For School Super Admins

ALTER TABLE public.profiles ALTER COLUMN full_name SET NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_number_key;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_school_phone_unique;

-- Phone number must be unique within a school, but can repeat across different schools
ALTER TABLE public.profiles ADD CONSTRAINT profiles_school_phone_unique UNIQUE (school_id, phone_number);

-- 3. Upgrade Junction Table
ALTER TABLE public.student_parents ADD COLUMN IF NOT EXISTS school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.student_parents DROP CONSTRAINT IF EXISTS student_parents_parent_id_fkey;
ALTER TABLE public.student_parents DROP CONSTRAINT IF EXISTS student_parents_parent_id_profiles_fkey;

ALTER TABLE public.student_parents 
    ADD CONSTRAINT student_parents_parent_id_profiles_fkey 
    FOREIGN KEY (parent_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.student_parents DROP CONSTRAINT IF EXISTS student_parents_relationship_type_check;
ALTER TABLE public.student_parents ADD CONSTRAINT student_parents_relationship_type_check 
    CHECK (relationship_type IN ('mother', 'father', 'guardian', 'other'));

-- ==========================================
-- STEP 4: INDEXING FOR PERFORMANCE
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_school_phone ON public.profiles(school_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON public.students(school_id, class_id);

-- ==========================================
-- STEP 5: SEED BOTH LEVELS OF ADMINISTRATORS
-- ==========================================
DO $$
DECLARE
    target_dev_uid UUID;
    school_admin_uid UUID := '77777777-7777-7777-7777-777777777777';
    kibali_school_id UUID := '11111111-1111-1111-1111-111111111111';
    real_password_hash TEXT := '$2a$10$LTg766F9YIwaa6W1D0.S2O00Fw6Fm7I6/Z70p1N/u7fM9XgQd2m6G';
BEGIN
    
    -- ------------------------------------------
    -- LEVEL 1 SEED: THE DEV TEAM (DYNAMIC INTEGRATION)
    -- ------------------------------------------
    -- Try to find your existing account ID if you already registered via the dashboard or code
    SELECT id INTO target_dev_uid FROM auth.users WHERE email = 'omolloandrew37@gmail.com';

    -- If you don't exist in the system yet, generate a clean placeholder UUID for you
    IF target_dev_uid IS NULL THEN
        target_dev_uid := '88888888-8888-8888-8888-888888888888';
        
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, last_sign_in_at, raw_app_meta_data, 
            raw_user_meta_data, created_at, updated_at, confirmation_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', target_dev_uid, 'authenticated', 'authenticated',
            'omolloandrew37@gmail.com', real_password_hash,
            NOW(), NOW(), '{"provider": "email", "providers": ["email"]}',
            '{"full_name": "SleekSites Developer"}', NOW(), NOW(), ''
        );
    END IF;

    -- Upsert the profile table using the verified ID to avoid constraint crashes
    INSERT INTO public.profiles (id, school_id, full_name, phone_number, is_dev, is_super_admin, role)
    VALUES (target_dev_uid, NULL, 'SleekSites Dev Team', '+254700000001', true, false, 'admin'::public.user_role)
    ON CONFLICT (id) DO UPDATE SET
        is_dev = true,
        is_super_admin = false,
        school_id = NULL,
        role = 'admin'::public.user_role;


    -- ------------------------------------------
    -- LEVEL 2 SEED: KIBALI SUPER ADMIN (TENANT-LOCKED)
    -- ------------------------------------------
    INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, 
        email_confirmed_at, last_sign_in_at, raw_app_meta_data, 
        raw_user_meta_data, created_at, updated_at, confirmation_token
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', school_admin_uid, 'authenticated', 'authenticated',
        'admin@kibali.ac.ke', real_password_hash,
        NOW(), NOW(), '{"provider": "email", "providers": ["email"]}',
        '{"full_name": "Kibali Principal"}', NOW(), NOW(), ''
    );

    INSERT INTO public.profiles (id, school_id, full_name, phone_number, is_dev, is_super_admin, role)
    VALUES (school_admin_uid, kibali_school_id, 'Kibali Super Admin', '+254700000002', false, true, 'admin'::public.user_role)
    ON CONFLICT (id) DO UPDATE SET
        is_dev = false,
        is_super_admin = true,
        school_id = kibali_school_id,
        role = 'admin'::public.user_role;

END $$;

COMMIT;