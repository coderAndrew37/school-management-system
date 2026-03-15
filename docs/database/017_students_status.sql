-- migration_013_student_status.sql
-- Adds a status column to students so records can be archived instead of deleted.
-- Run in Supabase SQL editor.

-- ── 1. Status type ────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE student_status AS ENUM ('active', 'transferred', 'graduated', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Add column ─────────────────────────────────────────────────────────────

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS status student_status NOT NULL DEFAULT 'active';

-- ── 3. Index for filtering ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_students_status ON public.students(status);

-- ── 4. All existing students are active ──────────────────────────────────────

UPDATE public.students SET status = 'active' WHERE status IS NULL;