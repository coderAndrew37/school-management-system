-- 1. Create the Schools Table
CREATE TABLE public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL, -- e.g., 'kibali', 'stmarys'
    county TEXT NOT NULL,
    primary_color VARCHAR(7) DEFAULT '#000000' NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
) TABLESPACE pg_default;

-- Add updated_at trigger for schools
CREATE TRIGGER schools_updated_at BEFORE UPDATE ON public.schools 
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. Enable Row Level Security
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 3. Define RLS Policies for Schools
CREATE POLICY "Allow public read access to active schools via subdomain" 
ON public.schools 
FOR SELECT 
USING (is_active = true);

-- Only Global Super Admins can manage school entries entirely
CREATE POLICY "Allow global system overrides full management" 
ON public.schools 
FOR ALL 
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'is_super_admin')::boolean = true
);

-- ========================================================
-- 1. UNIFIED PROFILES TABLE (Staff, Admins, and Parents)
-- ========================================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone_number TEXT UNIQUE,       -- For passwordless OTP login (Safaricom/Airtel)
    email TEXT UNIQUE NOT NULL,     -- Standard fallback
    avatar_url TEXT NULL,
    is_super_admin BOOLEAN DEFAULT false NOT NULL, -- Global System Bypass
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_profiles_school ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone_number);

-- ========================================================
-- 2. UPDATED MULTI-TENANT STUDENTS TABLE
-- ========================================================
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL, -- Multi-tenant anchor
    readable_id TEXT NOT NULL,       -- Admission Number (e.g., KIB-2026-042)
    upi_number TEXT NULL,           -- NEMIS/NEMIS UPI 
    assessment_number TEXT NULL,     -- CBC assessment number
    full_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT CHECK (gender IN ('Male', 'Female')),
    current_grade TEXT NOT NULL,    -- e.g., 'Grade 1', 'Form 4'
    class_id UUID NULL,             -- References your streams/classes table
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'transferred', 'alumni', 'suspended')),
    photo_url TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    CONSTRAINT students_school_readable_unique UNIQUE (school_id, readable_id), -- Adm No unique PER school
    CONSTRAINT students_upi_key UNIQUE (upi_number),
    CONSTRAINT students_assessment_key UNIQUE (assessment_number)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_students_school_class ON public.students(school_id, class_id);

-- ========================================================
-- 3. CLEAN PARENT-STUDENT JUNCTION TABLE
-- ========================================================
CREATE TABLE public.student_parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Points to unified profiles
    relationship_type TEXT NOT NULL DEFAULT 'guardian' CHECK (relationship_type IN ('mother', 'father', 'guardian', 'other')),
    is_primary_contact BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    CONSTRAINT unique_student_parent_pair UNIQUE (student_id, parent_id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_junction_student ON public.student_parents(student_id);
CREATE INDEX IF NOT EXISTS idx_junction_parent ON public.student_parents(parent_id);

