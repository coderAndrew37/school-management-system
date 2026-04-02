-- ============================================================
-- MIGRATION 010: CSL Logbook + Student Transfers
-- Kibali Academy CBC School Management System
-- ============================================================
-- Requires: migrations 001–009

-- 0. Prerequisites
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. student_status evolution ──────────────────────────────────────────────
-- Safe handling for existing enum vs new setup
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status') THEN
    CREATE TYPE student_status AS ENUM (
      'active',
      'transfer_pending',
      'transferred_out',
      'graduated',
      'withdrawn',
      'inactive'
    );
  ELSE
    -- Add new values to existing enum if they don't exist
    ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'transfer_pending';
    ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'transferred_out';
    ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'inactive';
  END IF;
END $$;

-- Add status column to students if it doesn't exist
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS status student_status NOT NULL DEFAULT 'active';

-- Add school_code (needed for QR payload)
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS school_code TEXT NULL;

-- Cleanup: Map old misspelled 'transfered' to 'transferred_out'
UPDATE students 
SET status = 'transferred_out' 
WHERE status::text = 'transfered';

-- ── 2. CSL strand enum ────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'csl_strand') THEN
    CREATE TYPE csl_strand AS ENUM (
      'Environment',
      'Citizenship',
      'Social Justice',
      'Health & Wellbeing',
      'Cultural Heritage',
      'Technology & Innovation',
      'Entrepreneurship',
      'Community Service'
    );
  END IF;
END $$;

-- Supervisor status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supervisor_status') THEN
    CREATE TYPE supervisor_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- ── 3. csl_logbook table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS csl_logbook (
  id                      UUID          NOT NULL DEFAULT uuid_generate_v4(),
  student_id              UUID          NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  academic_year           INTEGER       NOT NULL DEFAULT 2026,
  project_title           TEXT          NOT NULL,
  strand                  csl_strand    NOT NULL,
  activity_description    TEXT          NOT NULL,
  hours_spent             INTEGER       NOT NULL CHECK (hours_spent > 0 AND hours_spent <= 40),
  competencies_addressed  TEXT[]        NOT NULL DEFAULT '{}',
  student_reflection      TEXT          NOT NULL,
  supervisor_id           UUID          NULL REFERENCES teachers(id),
  supervisor_status       supervisor_status NOT NULL DEFAULT 'pending',
  supervisor_notes        TEXT          NULL,
  evidence_url            TEXT          NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT csl_logbook_pkey PRIMARY KEY (id)
);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION csl_logbook_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_csl_logbook_updated_at') THEN
    CREATE TRIGGER trg_csl_logbook_updated_at
      BEFORE UPDATE ON csl_logbook
      FOR EACH ROW EXECUTE FUNCTION csl_logbook_set_updated_at();
  END IF;
END $$;

-- Indexes for fast per-student / per-year queries
CREATE INDEX IF NOT EXISTS idx_csl_student_year
  ON csl_logbook (student_id, academic_year);

-- RLS: students see own rows; admins + supervisors see all
ALTER TABLE csl_logbook ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_own_csl"    ON csl_logbook;
DROP POLICY IF EXISTS "admin_teacher_csl"  ON csl_logbook;

CREATE POLICY "student_own_csl" ON csl_logbook
  FOR ALL TO authenticated
  USING (
    student_id = (
      SELECT id FROM students
      WHERE id::text = auth.uid()::text
      LIMIT 1
    )
  );

CREATE POLICY "admin_teacher_csl" ON csl_logbook
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'teacher')
    )
  );

-- ── 4. transfer_request table ─────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_direction') THEN
    CREATE TYPE transfer_direction AS ENUM ('outbound', 'inbound');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transfer_status') THEN
    CREATE TYPE transfer_status AS ENUM (
      'pending',
      'approved',
      'rejected',
      'completed'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS transfer_requests (
  id                    UUID              NOT NULL DEFAULT uuid_generate_v4(),
  student_id            UUID              NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  direction             transfer_direction NOT NULL,
  status                transfer_status   NOT NULL DEFAULT 'pending',
  -- Outbound
  destination_school    TEXT              NULL,
  reason                TEXT              NULL,
  clearance_pdf_url     TEXT              NULL,
  -- Inbound (from QR scan)
  source_school_code    TEXT              NULL,
  source_upi            TEXT              NULL,
  source_assessment_no  TEXT              NULL,
  scanned_qr_payload    JSONB             NULL,  -- full raw QR JSON for audit
  -- Admin handling
  initiated_by          UUID              NULL REFERENCES profiles(id),
  approved_by           UUID              NULL REFERENCES profiles(id),
  approved_at           TIMESTAMPTZ       NULL,
  rejection_reason      TEXT              NULL,
  notes                 TEXT              NULL,
  created_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT transfer_requests_pkey PRIMARY KEY (id)
);

CREATE OR REPLACE FUNCTION transfer_requests_set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_transfer_updated_at') THEN
    CREATE TRIGGER trg_transfer_updated_at
      BEFORE UPDATE ON transfer_requests
      FOR EACH ROW EXECUTE FUNCTION transfer_requests_set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transfer_student   ON transfer_requests (student_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status    ON transfer_requests (status);
CREATE INDEX IF NOT EXISTS idx_transfer_direction ON transfer_requests (direction);

ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_transfers" ON transfer_requests;
CREATE POLICY "admin_all_transfers" ON transfer_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ── 5. archived_assessments — SBA history kept across school changes ──────────
CREATE TABLE IF NOT EXISTS archived_assessments (
  LIKE assessments INCLUDING ALL
);

-- Override PK name to avoid clash
ALTER TABLE archived_assessments
  DROP CONSTRAINT IF EXISTS archived_assessments_pkey,
  ADD CONSTRAINT archived_assessments_pkey PRIMARY KEY (id);

-- Extra columns for archive provenance
ALTER TABLE archived_assessments
  ADD COLUMN IF NOT EXISTS archived_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS archived_reason     TEXT         NULL,
  ADD COLUMN IF NOT EXISTS source_school_code  TEXT         NULL;

ALTER TABLE archived_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_archived" ON archived_assessments;
CREATE POLICY "admin_all_archived" ON archived_assessments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ── 6. PL/pgSQL function: approve_inbound_transfer ────────────────────────────
CREATE OR REPLACE FUNCTION approve_inbound_transfer(
  p_transfer_id  UUID,
  p_student_id   UUID,
  p_approved_by  UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_archived_ids UUID[];
BEGIN
  -- 1. Collect archived assessment IDs for this student
  SELECT ARRAY_AGG(id)
    INTO v_archived_ids
    FROM archived_assessments
   WHERE student_id = p_student_id;

  -- 2. Move archived rows → live assessments
  IF v_archived_ids IS NOT NULL AND array_length(v_archived_ids, 1) > 0 THEN
    INSERT INTO assessments (
      id, student_id, teacher_id, subject_name, strand_id, score,
      evidence_url, teacher_remarks, term, academic_year,
      raw_score, max_score, is_final_sba, offline_id,
      created_at, updated_at
    )
    SELECT
      id, student_id, teacher_id, subject_name, strand_id, score,
      evidence_url, teacher_remarks, term, academic_year,
      raw_score, max_score, is_final_sba, offline_id,
      created_at, updated_at
    FROM archived_assessments
    WHERE id = ANY(v_archived_ids)
    ON CONFLICT (id) DO NOTHING;

    DELETE FROM archived_assessments WHERE id = ANY(v_archived_ids);
  END IF;

  -- 3. Activate student
  UPDATE students SET status = 'active' WHERE id = p_student_id;

  -- 4. Mark transfer completed
  UPDATE transfer_requests
     SET status      = 'completed',
         approved_by = p_approved_by,
         approved_at = NOW()
   WHERE id = p_transfer_id;
END;
$$;

-- ── 7. PL/pgSQL function: initiate_outbound_transfer ─────────────────────────
CREATE OR REPLACE FUNCTION initiate_outbound_transfer(
  p_student_id   UUID,
  p_initiated_by UUID,
  p_destination  TEXT,
  p_reason       TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transfer_id UUID;
BEGIN
  -- 1. Archive live assessments for this student
  INSERT INTO archived_assessments (
    id, student_id, teacher_id, subject_name, strand_id, score,
    evidence_url, teacher_remarks, term, academic_year,
    raw_score, max_score, is_final_sba, offline_id,
    created_at, updated_at, archived_at, archived_reason
  )
  SELECT
    id, student_id, teacher_id, subject_name, strand_id, score,
    evidence_url, teacher_remarks, term, academic_year,
    raw_score, max_score, is_final_sba, offline_id,
    created_at, updated_at, NOW(), 'transfer_out'
  FROM assessments
  WHERE student_id = p_student_id
  ON CONFLICT (id) DO NOTHING;

  -- 2. Set student status
  UPDATE students SET status = 'transfer_pending' WHERE id = p_student_id;

  -- 3. Create transfer request record
  INSERT INTO transfer_requests (
    student_id, direction, status,
    destination_school, reason, initiated_by
  )
  VALUES (
    p_student_id, 'outbound', 'pending',
    p_destination, p_reason, p_initiated_by
  )
  RETURNING id INTO v_transfer_id;

  RETURN v_transfer_id;
END;
$$;

COMMENT ON TABLE csl_logbook IS
  'Community Service Learning logbook entries for Grade 7–9 JSS students. Target: 20 hours per year.';

COMMENT ON TABLE transfer_requests IS
  'Student transfer workflow — inbound QR-scan and outbound clearance.';

COMMENT ON FUNCTION approve_inbound_transfer IS
  'Atomically restores archived SBA records, activates student, and completes transfer.';