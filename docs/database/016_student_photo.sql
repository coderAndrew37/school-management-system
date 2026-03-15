-- migration_012_student_photo.sql
-- Adds passport photo support to the students table.
-- Run in Supabase SQL editor.

-- ── 1. Add photo_url column ───────────────────────────────────────────────────

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT NULL;

COMMENT ON COLUMN public.students.photo_url IS
  'Storage path in the student-photos bucket, e.g. photos/uuid.jpg. Use getStudentPhotoUrl() to convert to a public URL.';

-- ── 2. Create the storage bucket ──────────────────────────────────────────────
-- Run this block once. If the bucket already exists, it is a no-op.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  true,                    -- public bucket so photos display in admin/parent portals
  2097152,                 -- 2 MB max per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Storage RLS policies ───────────────────────────────────────────────────

-- Admins and superadmins can upload, replace, and delete photos.
CREATE POLICY "admins_upload_student_photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'student-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "admins_update_student_photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "admins_delete_student_photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'student-photos'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- Teachers can read all student photos (for class displays).
-- Parents can read photos for their own children.
-- Since the bucket is public, the URL itself is world-readable — these policies
-- are for the storage API (signed URL generation, etc.), not the public CDN URL.
CREATE POLICY "authenticated_read_student_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'student-photos');