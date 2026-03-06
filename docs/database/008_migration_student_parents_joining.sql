-- ============================================================
-- MIGRATION 004: Student ↔ Parent — Many-to-Many Relationship
-- ============================================================
-- Run this in one transaction so it rolls back cleanly on failure.
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: DROP ALL POLICIES THAT DEPEND ON students.parent_id
--         (Supabase won't let us drop the column otherwise)
-- ============================================================

DROP POLICY IF EXISTS "students: parent read own children"          ON students;
DROP POLICY IF EXISTS "assessments: parent read own children"       ON assessments;
DROP POLICY IF EXISTS "narratives_parent_read_own"                  ON assessment_narratives;
DROP POLICY IF EXISTS "attendance: parent read own"                 ON attendance;
DROP POLICY IF EXISTS "diary: parent read own"                      ON student_diary;
DROP POLICY IF EXISTS "gallery: parent read own"                    ON talent_gallery;
DROP POLICY IF EXISTS "comm_book: read own threads"                 ON communication_book;
DROP POLICY IF EXISTS "comm_book: parent insert"                    ON communication_book;
DROP POLICY IF EXISTS "comm_book: update is_read"                   ON communication_book;
DROP POLICY IF EXISTS "fee_payments_parent_read_own"                ON fee_payments;

-- ============================================================
-- STEP 2: CREATE THE JOIN TABLE
-- ============================================================

CREATE TABLE student_parents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id           UUID NOT NULL REFERENCES parents(id)  ON DELETE CASCADE,
  relationship_type   TEXT NOT NULL DEFAULT 'guardian'
                        CHECK (relationship_type IN ('mother', 'father', 'guardian', 'other')),
  is_primary_contact  BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (student_id, parent_id)
);

CREATE INDEX idx_student_parents_student ON student_parents(student_id);
CREATE INDEX idx_student_parents_parent  ON student_parents(parent_id);

-- ============================================================
-- STEP 3: MIGRATE EXISTING DATA
-- ============================================================

INSERT INTO student_parents (student_id, parent_id, relationship_type, is_primary_contact)
SELECT id, parent_id, 'guardian', true
FROM   students
WHERE  parent_id IS NOT NULL;

-- ============================================================
-- STEP 4: DROP THE OLD COLUMN
--         Safe now — all dependent policies were dropped above.
-- ============================================================

ALTER TABLE students DROP COLUMN parent_id;

-- ============================================================
-- STEP 5: RLS ON THE JOIN TABLE
-- ============================================================

ALTER TABLE student_parents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "student_parents: admin all"
  ON student_parents FOR ALL
  USING (is_admin());

CREATE POLICY "student_parents: teacher read"
  ON student_parents FOR SELECT
  USING (is_teacher());

CREATE POLICY "student_parents: parent read own"
  ON student_parents FOR SELECT
  USING (parent_id = current_parent_id());

-- ============================================================
-- STEP 6: REBUILD ALL DEPENDENT POLICIES
--         Every subquery that was  WHERE parent_id = current_parent_id()
--         on the students table now goes through student_parents.
-- ============================================================

-- Helper subquery used everywhere:
--   SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()

-- ── Students ────────────────────────────────────────────────
CREATE POLICY "students: parent read own children"
  ON students FOR SELECT
  USING (
    id IN (
      SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
    )
  );

-- ── Assessments ─────────────────────────────────────────────
CREATE POLICY "assessments: parent read own children"
  ON assessments FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
    )
  );

-- ── Assessment narratives ────────────────────────────────────
CREATE POLICY "narratives_parent_read_own"
  ON assessment_narratives FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
    )
  );

-- ── Attendance ───────────────────────────────────────────────
CREATE POLICY "attendance: parent read own"
  ON attendance FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
    )
  );

-- ── Student diary ────────────────────────────────────────────
CREATE POLICY "diary: parent read own"
  ON student_diary FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
    )
  );

-- ── Talent gallery ───────────────────────────────────────────
CREATE POLICY "gallery: parent read own"
  ON talent_gallery FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
    )
  );

-- ── Fee payments ─────────────────────────────────────────────
CREATE POLICY "fee_payments_parent_read_own"
  ON fee_payments FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
    )
  );

-- ── Communication book ───────────────────────────────────────
CREATE POLICY "comm_book: read own threads"
  ON communication_book FOR SELECT
  USING (
    (
      auth_role() = 'parent'
      AND student_id IN (
        SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
      )
    )
    OR (is_teacher() OR is_admin())
  );

CREATE POLICY "comm_book: parent insert"
  ON communication_book FOR INSERT
  WITH CHECK (
    auth_role() = 'parent'
    AND student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
    )
    AND sender_id = auth.uid()
  );

CREATE POLICY "comm_book: update is_read"
  ON communication_book FOR UPDATE
  USING (
    (
      auth_role() = 'parent'
      AND student_id IN (
        SELECT student_id FROM student_parents WHERE parent_id = current_parent_id()
      )
    )
    OR (is_teacher() OR is_admin())
  )
  WITH CHECK (true);

COMMIT;