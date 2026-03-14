-- migration_010_public_applications.sql
-- Creates the public_applications table that receives submissions from the
-- website admission form. Applications are reviewed by admins and either
-- converted to students (approved) or declined.
-- Run in Supabase SQL editor.

-- ── 1. Status enum ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('pending', 'reviewing', 'approved', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Main table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference shown to applicant e.g. KEC-2026-0001
  reference_number    TEXT UNIQUE NOT NULL,

  -- Student
  student_first_name  TEXT NOT NULL,
  student_last_name   TEXT NOT NULL,
  student_gender      TEXT NOT NULL CHECK (student_gender IN ('male', 'female', 'other')),
  student_dob         DATE NOT NULL,
  current_grade       TEXT NOT NULL,    -- grade they are currently in
  applying_for_grade  TEXT NOT NULL,    -- grade they want to join

  -- Parent / guardian
  parent_first_name   TEXT NOT NULL,
  parent_last_name    TEXT NOT NULL,
  parent_email        TEXT NOT NULL,
  parent_phone        TEXT NOT NULL,
  parent_relationship TEXT NOT NULL CHECK (parent_relationship IN ('mother','father','guardian','other')),

  -- Address
  address             TEXT,
  city                TEXT,
  postal_code         TEXT,

  -- Optional extras
  previous_school     TEXT,
  special_needs       TEXT,
  interests           TEXT,

  -- Consent
  agree_to_terms      BOOLEAN NOT NULL DEFAULT TRUE,
  receive_updates     BOOLEAN NOT NULL DEFAULT FALSE,

  -- Workflow
  status              application_status NOT NULL DEFAULT 'pending',
  admin_notes         TEXT,                    -- internal notes
  reviewed_by         UUID REFERENCES profiles(id),
  reviewed_at         TIMESTAMPTZ,
  converted_student_id UUID REFERENCES students(id), -- set when approved + admitted

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 3. Reference number generator ────────────────────────────────────────────
-- Format: KEC-YYYY-NNNN (zero-padded 4 digits per year)

CREATE SEQUENCE IF NOT EXISTS application_ref_seq;

CREATE OR REPLACE FUNCTION generate_application_reference()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  year_str TEXT := TO_CHAR(NOW(), 'YYYY');
  seq_val  INT;
BEGIN
  seq_val := nextval('application_ref_seq');
  NEW.reference_number := 'KEC-' || year_str || '-' || LPAD(seq_val::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_application_reference ON public_applications;
CREATE TRIGGER set_application_reference
  BEFORE INSERT ON public_applications
  FOR EACH ROW
  WHEN (NEW.reference_number IS NULL OR NEW.reference_number = '')
  EXECUTE FUNCTION generate_application_reference();

-- ── 4. updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS touch_public_applications_updated_at ON public_applications;
CREATE TRIGGER touch_public_applications_updated_at
  BEFORE UPDATE ON public_applications
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 5. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_public_applications_status     ON public_applications(status);
CREATE INDEX IF NOT EXISTS idx_public_applications_created_at ON public_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_applications_email      ON public_applications(parent_email);

-- ── 6. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public_applications ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (website form submissions — unauthenticated)
CREATE POLICY "public_can_apply" ON public_applications
  FOR INSERT WITH CHECK (true);

-- Admins can read all, update status/notes
CREATE POLICY "admin_read_applications" ON public_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "admin_update_applications" ON public_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );