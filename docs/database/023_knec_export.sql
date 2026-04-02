-- ============================================================
-- MIGRATION 009: KNEC Exam Support
-- Adds: assessment_number (KPSEA), historical_sba_overrides
-- Kibali Academy CBC School Management System
-- ============================================================
-- Requires: migrations 001–008

-- ── 1. Add raw_score, max_score, is_final_sba, offline_id to assessments ──────
-- (These match the live schema shown in the spec; guard with IF NOT EXISTS)

ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS raw_score    NUMERIC       NULL,
  ADD COLUMN IF NOT EXISTS max_score    NUMERIC       NULL,
  ADD COLUMN IF NOT EXISTS is_final_sba BOOLEAN       NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS offline_id   UUID          NULL;

-- Unique index on offline_id so it can be used as an idempotency key
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assessments_offline_id_key'
  ) THEN
    ALTER TABLE assessments ADD CONSTRAINT assessments_offline_id_key UNIQUE (offline_id);
  END IF;
END $$;

-- ── 2. Add assessment_number (KPSEA) to students ──────────────────────────────
-- Distinct from upi_number — issued by KNEC for Grade 6 national registration.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS assessment_number TEXT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'students_assessment_number_key'
  ) THEN
    ALTER TABLE students ADD CONSTRAINT students_assessment_number_key UNIQUE (assessment_number);
  END IF;
END $$;

-- ── 3. historical_sba_overrides — manual entry for transfer students ───────────
-- Admin can enter G4/G5 data from paper records when Supabase has no rows.

CREATE TABLE IF NOT EXISTS historical_sba_overrides (
  id             UUID         NOT NULL DEFAULT extensions.uuid_generate_v4(),
  student_id     UUID         NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year  INTEGER      NOT NULL,          -- e.g. 2024 = Grade 4 year
  knec_area      TEXT         NOT NULL,          -- e.g. 'English'
  avg_percentage NUMERIC(5,2) NOT NULL CHECK (avg_percentage >= 0 AND avg_percentage <= 100),
  source_school  TEXT         NULL,              -- name of previous school
  entered_by     UUID         NULL REFERENCES profiles(id),
  entered_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  notes          TEXT         NULL,

  CONSTRAINT historical_sba_overrides_pkey PRIMARY KEY (id),
  CONSTRAINT historical_sba_overrides_uq   UNIQUE (student_id, academic_year, knec_area)
);

-- RLS: only admins can read/write overrides
ALTER TABLE historical_sba_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_overrides" ON historical_sba_overrides;
CREATE POLICY "admin_all_overrides"
  ON historical_sba_overrides
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── 4. Index for fast KPSEA queries ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_assessments_final_sba
  ON assessments (student_id, academic_year, is_final_sba)
  WHERE is_final_sba = TRUE;

CREATE INDEX IF NOT EXISTS idx_overrides_student_year
  ON historical_sba_overrides (student_id, academic_year);

COMMENT ON COLUMN students.assessment_number IS
  'KNEC-issued assessment number for KPSEA registration (Grade 6). '
  'Distinct from upi_number. Required before KPSEA export.';

COMMENT ON TABLE historical_sba_overrides IS
  'Manual SBA data entry for transfer students who lack G4/G5 digital records. '
  'Admin-only. Used by KPSEA cumulative aggregator when assessments rows are absent.';