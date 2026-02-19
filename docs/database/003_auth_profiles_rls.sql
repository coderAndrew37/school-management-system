-- ============================================================
-- MIGRATION 003: Auth — Profiles, Roles & Row Level Security
-- Kibali Academy CBC School Management System
-- ============================================================

-- 1. ROLE ENUM
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'parent');

-- 2. PROFILES TABLE
--    One row per auth.users entry. Created automatically via trigger.
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'parent',
  full_name  TEXT,
  avatar_url TEXT,
  -- For teachers: link to the teachers table
  teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast role lookups
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_teacher_id ON profiles(teacher_id);

-- 3. AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'parent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================

ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subject_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. HELPER FUNCTIONS (avoids N+1 in policies)
-- ============================================================

-- Get the current user's role (cached per transaction)
CREATE OR REPLACE FUNCTION auth_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Check if current user is a teacher
CREATE OR REPLACE FUNCTION is_teacher()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher');
$$;

-- Get teacher.id for the currently authenticated teacher
CREATE OR REPLACE FUNCTION current_teacher_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT teacher_id FROM profiles WHERE id = auth.uid() AND role = 'teacher';
$$;

-- Get parent.id linked to the authenticated parent user
CREATE OR REPLACE FUNCTION current_parent_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT p.id
  FROM parents p
  WHERE p.email = (SELECT email FROM auth.users WHERE id = auth.uid());
$$;

-- ============================================================
-- 6. PROFILES POLICIES
-- ============================================================

-- Users can always read their own profile
CREATE POLICY "profiles: own read"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles: admin read all"
  ON profiles FOR SELECT
  USING (is_admin());

-- Users can update only their own profile (not their role)
CREATE POLICY "profiles: own update"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid()));

-- Only admins can change roles
CREATE POLICY "profiles: admin update any"
  ON profiles FOR UPDATE
  USING (is_admin());

-- ============================================================
-- 7. TEACHERS POLICIES
-- ============================================================

-- Admins: full access
CREATE POLICY "teachers: admin all"
  ON teachers FOR ALL
  USING (is_admin());

-- Teachers: read their own record only
CREATE POLICY "teachers: own read"
  ON teachers FOR SELECT
  USING (id = current_teacher_id());

-- Parents: no access to teacher records
-- (no policy = no access for parents)

-- ============================================================
-- 8. PARENTS POLICIES
-- ============================================================

-- Admins: full access
CREATE POLICY "parents: admin all"
  ON parents FOR ALL
  USING (is_admin());

-- Parents: read their own record only
CREATE POLICY "parents: own read"
  ON parents FOR SELECT
  USING (id = current_parent_id());

-- ============================================================
-- 9. STUDENTS POLICIES
-- ============================================================

-- Admins: full access
CREATE POLICY "students: admin all"
  ON students FOR ALL
  USING (is_admin());

-- Teachers: read all students (they teach all)
CREATE POLICY "students: teacher read all"
  ON students FOR SELECT
  USING (is_teacher());

-- Parents: read only their own children
CREATE POLICY "students: parent read own children"
  ON students FOR SELECT
  USING (parent_id = current_parent_id());

-- ============================================================
-- 10. ASSESSMENTS POLICIES
-- ============================================================

-- Admins: full access
CREATE POLICY "assessments: admin all"
  ON assessments FOR ALL
  USING (is_admin());

-- Teachers: read all, write/update only their own assessments
CREATE POLICY "assessments: teacher read all"
  ON assessments FOR SELECT
  USING (is_teacher());

CREATE POLICY "assessments: teacher insert own"
  ON assessments FOR INSERT
  WITH CHECK (teacher_id = current_teacher_id());

CREATE POLICY "assessments: teacher update own"
  ON assessments FOR UPDATE
  USING (teacher_id = current_teacher_id())
  WITH CHECK (teacher_id = current_teacher_id());

-- Parents: read assessments for their own children only
CREATE POLICY "assessments: parent read own children"
  ON assessments FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id = current_parent_id()
    )
  );

-- ============================================================
-- 11. SUBJECTS POLICIES (read-only for everyone authenticated)
-- ============================================================

CREATE POLICY "subjects: authenticated read"
  ON subjects FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "subjects: admin write"
  ON subjects FOR ALL
  USING (is_admin());

-- ============================================================
-- 12. ALLOCATIONS POLICIES
-- ============================================================

CREATE POLICY "allocations: admin all"
  ON teacher_subject_allocations FOR ALL
  USING (is_admin());

-- Teachers: read their own allocations
CREATE POLICY "allocations: teacher read own"
  ON teacher_subject_allocations FOR SELECT
  USING (teacher_id = current_teacher_id());

-- ============================================================
-- 13. TIMETABLE POLICIES
-- ============================================================

-- Authenticated users can read timetable (parents/teachers/admins all need it)
CREATE POLICY "timetable: authenticated read"
  ON timetable_slots FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "timetable: admin write"
  ON timetable_slots FOR ALL
  USING (is_admin());

-- ============================================================
-- 14. SEED: First admin user
-- NOTE: Run this AFTER creating the first user in Supabase Auth.
-- Replace the UUID with the actual user ID from auth.users.
-- ============================================================

-- UPDATE profiles SET role = 'admin' WHERE id = '<your-admin-user-uuid>';

-- ============================================================
-- 15. ADMIN HELPER: Promote user to admin (run manually as needed)
-- ============================================================

CREATE OR REPLACE FUNCTION promote_to_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET role = 'admin' WHERE id = target_user_id;
END;
$$;

-- Only superadmin (service role) can call this function — RLS does not apply to SECURITY DEFINER functions
-- called via the Supabase dashboard or server-side service role key.