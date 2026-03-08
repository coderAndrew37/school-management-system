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

-- Ensure required columns exist
-- media_url is the primary storage path column (NOT NULL enforced below)
ALTER TABLE talent_gallery
  ADD COLUMN IF NOT EXISTS title          TEXT,
  ADD COLUMN IF NOT EXISTS created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT now();

-- If your existing table uses a different column name (e.g. url, image_url),
-- rename it to media_url:
-- ALTER TABLE talent_gallery RENAME COLUMN url TO media_url;
-- ALTER TABLE talent_gallery RENAME COLUMN image_url TO media_url;

-- Ensure media_url exists (skip if already present via rename above)
ALTER TABLE talent_gallery
  ADD COLUMN IF NOT EXISTS media_url TEXT NOT NULL DEFAULT '';

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
-- Storage policies CANNOT be created with raw SQL in the same way as table policies.
-- You must create them via the Supabase Dashboard:
--
--   Dashboard → Storage → gallery bucket → Policies → New Policy
--
--   Policy 1 — INSERT (teachers upload their own folder):
--     Policy name:  teachers can upload
--     Allowed operation: INSERT
--     Target roles: authenticated
--     USING expression: (leave blank for INSERT)
--     WITH CHECK expression:
--       (storage.foldername(name))[1] = auth.uid()::text
--       AND EXISTS (
--         SELECT 1 FROM profiles
--         WHERE id = auth.uid()
--         AND role IN ('teacher', 'admin')
--       )
--
--   Policy 2 — SELECT (authenticated users can read — signed URLs add extra security):
--     Policy name:  authenticated read
--     Allowed operation: SELECT
--     Target roles: authenticated
--     USING expression:
--       EXISTS (
--         SELECT 1 FROM profiles
--         WHERE id = auth.uid()
--         AND role IN ('teacher', 'admin', 'parent')
--       )
--
--   Policy 3 — DELETE (teachers delete their own files):
--     Policy name:  teachers delete own
--     Allowed operation: DELETE
--     Target roles: authenticated
--     USING expression:
--       (storage.foldername(name))[1] = auth.uid()::text
--
-- NOTE: The app uses SIGNED URLS (not public URLs) so even if SELECT is broad,
-- the time-limited signed URL is the real access control layer for parents.

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
-- 3. Public: OFF (private — app uses signed URLs)
-- 4. File size limit: 10 MB
-- 5. Allowed types: image/jpeg, image/png, image/webp, image/gif
--
-- Storage path convention used by the app:
--   {teacher_id}/{uuid}.{ext}
--
-- Then create 3 storage policies via:
--   Dashboard → Storage → gallery → Policies
-- (See the detailed instructions in section 3 of this migration)
-- ============================================================