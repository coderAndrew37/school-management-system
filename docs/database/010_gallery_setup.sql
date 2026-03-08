-- ============================================================
-- MIGRATION 006: Gallery System — CBC Evidence-Based Learning
-- ============================================================
-- Extends talent_gallery to support:
--   1. Audience scoping: per-student OR class-wide OR school-wide
--   2. Category tags: CBC learning areas
--   3. Supabase Storage bucket: "gallery"
--   4. RLS: teacher write, parent read (scoped), admin all
-- Safe to re-run (uses IF EXISTS / OR REPLACE).
-- ============================================================

BEGIN;

-- ── 1. Extend talent_gallery ──────────────────────────────────────────────────

-- Add audience column: 'student' | 'class' | 'school'
ALTER TABLE talent_gallery
  ADD COLUMN IF NOT EXISTS audience       TEXT NOT NULL DEFAULT 'student'
    CHECK (audience IN ('student', 'class', 'school')),

  -- For class-wide posts: which grade sees this (e.g. "Grade 4")
  ADD COLUMN IF NOT EXISTS target_grade   TEXT,

  -- For school-wide posts: student_id may be NULL
  ALTER COLUMN student_id DROP NOT NULL,

  -- CBC learning areas / activity category
  ADD COLUMN IF NOT EXISTS category       TEXT,

  -- Free-form caption / description
  ADD COLUMN IF NOT EXISTS caption        TEXT,

  -- Which teacher uploaded it
  ADD COLUMN IF NOT EXISTS teacher_id     UUID REFERENCES teachers(id) ON DELETE SET NULL,

  -- Term & academic year context
  ADD COLUMN IF NOT EXISTS term           INT CHECK (term IN (1, 2, 3)),
  ADD COLUMN IF NOT EXISTS academic_year  INT DEFAULT 2026,

  -- Soft delete
  ADD COLUMN IF NOT EXISTS deleted_at     TIMESTAMPTZ;

-- Ensure image_url column exists (may already exist as url or image_url)
ALTER TABLE talent_gallery
  ADD COLUMN IF NOT EXISTS image_url      TEXT,
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- Index for fast parent queries
CREATE INDEX IF NOT EXISTS idx_gallery_student_id    ON talent_gallery (student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gallery_target_grade  ON talent_gallery (target_grade) WHERE target_grade IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gallery_audience      ON talent_gallery (audience);
CREATE INDEX IF NOT EXISTS idx_gallery_created_at    ON talent_gallery (created_at DESC);

-- ── 2. Supabase Storage bucket ────────────────────────────────────────────────
-- Create via Supabase dashboard OR the storage API. SQL below is for reference.
-- The bucket should be: name="gallery", public=false
-- (Images are served via signed URLs, not public — keeps privacy intact)

-- NOTE: Run this in the Supabase Dashboard > Storage > New Bucket if it doesn't exist:
-- Bucket name: gallery
-- Public: OFF (use signed URLs)
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

-- ── 3. Storage RLS policies ───────────────────────────────────────────────────
-- Teachers can upload to: gallery/{teacher_id}/{filename}
-- Parents can read files linked to their children (enforced at app level via signed URLs)

-- ── 4. Database RLS ───────────────────────────────────────────────────────────

ALTER TABLE talent_gallery ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "gallery: parent read own"      ON talent_gallery;
DROP POLICY IF EXISTS "gallery: teacher write"        ON talent_gallery;
DROP POLICY IF EXISTS "gallery: admin all"            ON talent_gallery;
DROP POLICY IF EXISTS "gallery: teacher/admin select" ON talent_gallery;

-- Teachers can read all gallery items in their grades
CREATE POLICY "gallery: teacher/admin select"
  ON talent_gallery FOR SELECT
  USING (is_teacher() OR is_admin());

-- Teachers can insert/update/delete their own gallery items
CREATE POLICY "gallery: teacher write"
  ON talent_gallery FOR ALL
  USING (
    is_teacher()
    AND (teacher_id = auth.uid() OR teacher_id IS NULL)
  )
  WITH CHECK (
    is_teacher()
  );

-- Admin can do everything
CREATE POLICY "gallery: admin all"
  ON talent_gallery FOR ALL
  USING (is_admin());

-- Parents can see:
-- (a) images tagged for their student specifically
-- (b) images tagged class-wide for their student's grade
-- (c) images tagged school-wide
CREATE POLICY "gallery: parent read own"
  ON talent_gallery FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      -- (a) student-specific
      (
        audience = 'student'
        AND student_id IN (
          SELECT student_id FROM student_parents
          WHERE parent_id = current_parent_id()
        )
      )
      OR
      -- (b) class-wide — grade matches parent's child's grade
      (
        audience = 'class'
        AND target_grade IN (
          SELECT s.current_grade FROM students s
          JOIN student_parents sp ON sp.student_id = s.id
          WHERE sp.parent_id = current_parent_id()
        )
      )
      OR
      -- (c) school-wide — all parents see these
      (
        audience = 'school'
        AND current_parent_id() IS NOT NULL
      )
    )
  );

-- ── 5. Updated_at trigger ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_gallery_updated_at ON talent_gallery;
CREATE TRIGGER trg_gallery_updated_at
  BEFORE UPDATE ON talent_gallery
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 6. Backfill existing rows ─────────────────────────────────────────────────
-- Existing rows without audience default to 'student'
UPDATE talent_gallery
SET audience = 'student'
WHERE audience IS NULL;

COMMIT;

-- ============================================================
-- AFTER RUNNING: Set up Storage bucket in Supabase Dashboard
-- ============================================================
-- 1. Go to Storage → New Bucket
-- 2. Name: gallery
-- 3. Public: OFF
-- 4. File size limit: 10 MB
-- 5. Allowed types: image/jpeg, image/png, image/webp, image/gif
--
-- Storage path convention used by the app:
--   {teacher_id}/{uuid}.{ext}
--
-- RLS for storage (add in Dashboard > Storage > Policies > gallery bucket):
--
-- INSERT policy (teachers only):
--   ((storage.foldername(name))[1] = auth.uid()::text)
--   AND (auth_role() = 'teacher' OR auth_role() = 'admin')
--
-- SELECT policy (teachers + parents via signed URL — handled in app):
--   (auth_role() IN ('teacher', 'admin', 'parent'))
-- ============================================================