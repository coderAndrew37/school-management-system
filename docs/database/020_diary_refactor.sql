-- ─────────────────────────────────────────────────────────────────────────────
-- CBC Diary Refactor Migration (v2 — fixes constraint violation on existing data)
-- Run in Supabase SQL editor
-- Safe: additive only — no columns dropped, no data lost
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add entry_type WITHOUT the check constraint yet (we add it at the end
--    after existing data has been cleaned up)
ALTER TABLE public.student_diary
  ADD COLUMN IF NOT EXISTS entry_type text NOT NULL DEFAULT 'homework';

-- 2. Add grade column
ALTER TABLE public.student_diary
  ADD COLUMN IF NOT EXISTS grade text;

-- 3. Back-fill grade from the students table for all existing rows
UPDATE public.student_diary sd
SET grade = s.current_grade
FROM public.students s
WHERE sd.student_id = s.id
  AND sd.grade IS NULL;

-- 4. The original schema required student_id on every row, but those rows are
--    class-wide homework/notices in spirit. Now that grade is captured we can
--    null out student_id — which is what the scope constraint requires for
--    homework and notice entries.
--
--    NOTE: if you have any rows that were genuine per-student observations,
--    identify and update them BEFORE running this step:
--      SELECT id, student_id, title FROM student_diary;
--    Set entry_type = 'observation' for those rows first, then run this.
UPDATE public.student_diary
SET student_id = NULL
WHERE entry_type IN ('homework', 'notice')
  AND student_id IS NOT NULL;

-- 5. Now that data is clean, add the entry_type value check
ALTER TABLE public.student_diary
  DROP CONSTRAINT IF EXISTS student_diary_entry_type_check;

ALTER TABLE public.student_diary
  ADD CONSTRAINT student_diary_entry_type_check
    CHECK (entry_type IN ('homework', 'notice', 'observation'));

-- 6. Drop and re-add the scope constraint — data now satisfies it
ALTER TABLE public.student_diary
  DROP CONSTRAINT IF EXISTS chk_diary_scope;

ALTER TABLE public.student_diary
  ADD CONSTRAINT chk_diary_scope CHECK (
    (entry_type = 'observation' AND student_id IS NOT NULL)
    OR
    (entry_type IN ('homework', 'notice') AND student_id IS NULL)
  );

-- 7. Grade index for fast parent portal queries
CREATE INDEX IF NOT EXISTS idx_student_diary_grade
  ON public.student_diary (grade);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification — run these after to confirm all is well
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT entry_type, count(*), count(student_id) as has_student_id
--   FROM student_diary GROUP BY entry_type;
-- SELECT * FROM student_diary WHERE grade IS NULL;
-- SELECT conname FROM pg_constraint WHERE conrelid = 'student_diary'::regclass;