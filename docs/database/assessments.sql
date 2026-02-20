-- ============================================================
-- MIGRATION 005: Batch Assessment & Narrative Remarks
-- Kibali Academy CBC School Management System
-- ============================================================
-- Requires: migrations 001–004

-- ── 1. Add updated_at + strand label to assessments ───────────────────────────
-- (The column may already exist if re-running; use IF NOT EXISTS guard)

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION assessments_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_assessments_updated_at'
  ) THEN
    CREATE TRIGGER trg_assessments_updated_at
      BEFORE UPDATE ON assessments
      FOR EACH ROW EXECUTE FUNCTION assessments_set_updated_at();
  END IF;
END $$;

-- ── 2. UPSERT CONSTRAINT ──────────────────────────────────────────────────────
-- Allow upsert by (student_id, subject_name, strand_id, term, academic_year)
-- so the batch save can use ON CONFLICT DO UPDATE

ALTER TABLE assessments
  DROP CONSTRAINT IF EXISTS uq_assessment_key;

ALTER TABLE assessments
  ADD CONSTRAINT uq_assessment_key
  UNIQUE (student_id, subject_name, strand_id, term, academic_year);

-- ── 3. NARRATIVE REMARKS CACHE ────────────────────────────────────────────────
-- Stores AI-generated narrative remarks per student/subject/term
-- so we don't re-generate on every page load

CREATE TABLE IF NOT EXISTS assessment_narratives (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id     UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_name   TEXT        NOT NULL,
  term           SMALLINT    NOT NULL CHECK (term IN (1,2,3)),
  academic_year  INTEGER     NOT NULL DEFAULT 2026,
  narrative      TEXT        NOT NULL,
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- allow one narrative per student/subject/term/year
  UNIQUE (student_id, subject_name, term, academic_year)
);

CREATE INDEX IF NOT EXISTS idx_narratives_student
  ON assessment_narratives(student_id, term, academic_year);

-- ── 4. RLS on assessment_narratives ──────────────────────────────────────────

ALTER TABLE assessment_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "narratives_admin"
  ON assessment_narratives FOR ALL
  TO authenticated USING (is_admin());

CREATE POLICY "narratives_teacher_all"
  ON assessment_narratives FOR ALL
  TO authenticated USING (is_teacher());

CREATE POLICY "narratives_parent_read_own"
  ON assessment_narratives FOR SELECT
  TO authenticated
  USING (
    student_id IN (
      SELECT id FROM students WHERE parent_id = current_parent_id()
    )
  );