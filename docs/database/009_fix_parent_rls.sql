-- ============================================================
-- MIGRATION 005: Fix stale RLS policies + profiles.roles column
-- ============================================================
-- Run in Supabase SQL Editor. Safe to re-run (uses IF EXISTS / OR REPLACE).
-- ============================================================

BEGIN;

-- ============================================================
-- PART A: Ensure current_parent_id() uses id-based lookup
--         (not email — more reliable, avoids case sensitivity issues)
-- ============================================================

CREATE OR REPLACE FUNCTION current_parent_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM parents WHERE id = auth.uid();
$$;

-- ============================================================
-- PART B: Add roles[] column to profiles
--         Used by the frontend (middleware + nav) for multi-role users.
--         The singular `role` column remains the RLS source of truth.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS roles user_role[] NOT NULL DEFAULT '{}';

-- Back-fill: set roles[] from the existing role column for all existing rows
UPDATE profiles
SET roles = ARRAY[role]
WHERE roles = '{}' OR roles IS NULL;

-- Trigger to keep roles[] in sync when role changes (single-role users)
CREATE OR REPLACE FUNCTION sync_profile_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- If roles is empty, populate it from role
  IF array_length(NEW.roles, 1) IS NULL OR NEW.roles = '{}' THEN
    NEW.roles := ARRAY[NEW.role];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_profile_roles ON profiles;
CREATE TRIGGER trg_sync_profile_roles
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_roles();

-- ============================================================
-- PART C: Drop ALL stale policies that used the old pattern
--         WHERE parent_id = current_parent_id()  (on students directly)
--         or SELECT id FROM students WHERE parent_id = current_parent_id()
-- ============================================================

-- These were already dropped in migration 004, but include IF EXISTS
-- so re-running this migration is safe.

DROP POLICY IF EXISTS "students: parent read own children"    ON students;
DROP POLICY IF EXISTS "assessments: parent read own children" ON assessments;
DROP POLICY IF EXISTS "narratives_parent_read_own"            ON assessment_narratives;
DROP POLICY IF EXISTS "attendance: parent read own"           ON attendance;
DROP POLICY IF EXISTS "diary: parent read own"                ON student_diary;
DROP POLICY IF EXISTS "gallery: parent read own"              ON talent_gallery;
DROP POLICY IF EXISTS "comm_book: read own threads"           ON communication_book;
DROP POLICY IF EXISTS "comm_book: parent insert"              ON communication_book;
DROP POLICY IF EXISTS "comm_book: update is_read"             ON communication_book;
DROP POLICY IF EXISTS "fee_payments_parent_read_own"          ON fee_payments;

-- ============================================================
-- PART D: Recreate all parent-scoped policies using student_parents
-- ============================================================

-- Reusable subquery pattern:
--   student_id IN (SELECT student_id FROM student_parents WHERE parent_id = current_parent_id())

-- ── Students ─────────────────────────────────────────────────────────────────
CREATE POLICY "students: parent read own children"
  ON students FOR SELECT
  USING (
    id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

-- ── Assessments ──────────────────────────────────────────────────────────────
CREATE POLICY "assessments: parent read own children"
  ON assessments FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

-- ── Assessment narratives ─────────────────────────────────────────────────────
CREATE POLICY "narratives_parent_read_own"
  ON assessment_narratives FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

-- ── Attendance ────────────────────────────────────────────────────────────────
CREATE POLICY "attendance: parent read own"
  ON attendance FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

-- ── Student diary ─────────────────────────────────────────────────────────────
CREATE POLICY "diary: parent read own"
  ON student_diary FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

-- ── Talent gallery ────────────────────────────────────────────────────────────
CREATE POLICY "gallery: parent read own"
  ON talent_gallery FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

-- ── Fee payments ──────────────────────────────────────────────────────────────
CREATE POLICY "fee_payments_parent_read_own"
  ON fee_payments FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

-- ── Communication book ────────────────────────────────────────────────────────
CREATE POLICY "comm_book: read own threads"
  ON communication_book FOR SELECT
  USING (
    (
      auth_role() = 'parent'
      AND student_id IN (
        SELECT student_id FROM student_parents
        WHERE parent_id = current_parent_id()
      )
    )
    OR is_teacher()
    OR is_admin()
  );

CREATE POLICY "comm_book: parent insert"
  ON communication_book FOR INSERT
  WITH CHECK (
    auth_role() = 'parent'
    AND sender_id = auth.uid()
    AND student_id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

CREATE POLICY "comm_book: update is_read"
  ON communication_book FOR UPDATE
  USING (
    (
      auth_role() = 'parent'
      AND student_id IN (
        SELECT student_id FROM student_parents
        WHERE parent_id = current_parent_id()
      )
    )
    OR is_teacher()
    OR is_admin()
  )
  WITH CHECK (true);

-- ============================================================
-- PART E: Ensure notifications RLS is correct (uses student_parents)
-- ============================================================

DROP POLICY IF EXISTS "notifications: parent read own" ON notifications;

CREATE POLICY "notifications: parent read own"
  ON notifications FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

-- ============================================================
-- PART F: jss_pathways RLS (commonly missing)
-- ============================================================

ALTER TABLE jss_pathways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pathways: parent read own" ON jss_pathways;
DROP POLICY IF EXISTS "pathways: teacher/admin all" ON jss_pathways;

CREATE POLICY "pathways: parent read own"
  ON jss_pathways FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents
      WHERE parent_id = current_parent_id()
    )
  );

CREATE POLICY "pathways: teacher/admin all"
  ON jss_pathways FOR ALL
  USING (is_teacher() OR is_admin());

-- ============================================================
-- VERIFY — Run these SELECTs after committing to confirm setup
-- ============================================================
-- SELECT id, full_name, role, roles FROM profiles LIMIT 10;
-- SELECT id, email, invite_accepted FROM parents LIMIT 10;
-- SELECT * FROM student_parents LIMIT 10;

COMMIT;