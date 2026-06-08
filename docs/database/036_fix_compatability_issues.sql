-- 1. Add school_id column allowing nulls temporarily (so existing data doesn't crash)
ALTER TABLE public.classes 
ADD COLUMN school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

-- 2. IMPORTANT: If you already have data, link your existing classes to a default school ID now!
-- REPLACE 'your-default-school-uuid-here' with an actual school ID from your public.schools table.
UPDATE public.classes 
SET school_id = 'your-default-school-uuid-here' 
WHERE school_id IS NULL;

-- 3. Now enforce that school_id cannot be null for future classes
ALTER TABLE public.classes 
ALTER COLUMN school_id SET NOT NULL;

-- 4. Drop the old unique constraint that didn't care about schools
ALTER TABLE public.classes 
DROP CONSTRAINT IF EXISTS uq_class_grade_stream_year;

-- 5. Create a new composite unique constraint that is scope-isolated per school
ALTER TABLE public.classes 
ADD CONSTRAINT uq_class_school_grade_stream_year UNIQUE (school_id, grade, stream, academic_year);

-- 6. Rebuild your index to include school lookups
DROP INDEX IF EXISTS idx_classes_lookup;
CREATE INDEX idx_classes_lookup ON public.classes USING btree (school_id, grade, stream, academic_year);

-- 1. Add school_id to notifications (multitenancy)
alter table public.notifications
  add column school_id uuid null
    references schools (id) on delete cascade;

-- Backfill from students (since notifications link to students)
update public.notifications n
set school_id = s.school_id
from public.students s
where n.student_id = s.id
  and n.school_id is null;

-- Once backfilled, make it not-null if all rows resolved cleanly
-- (check first: select count(*) from notifications where school_id is null;)
-- alter table public.notifications alter column school_id set not null;

create index if not exists idx_notifications_school
  on public.notifications using btree (school_id);

create index if not exists idx_notifications_student
  on public.notifications using btree (student_id);

-- 2. Add parent_id to notifications so we can join to profiles
--    This is who the notification is addressed to
alter table public.notifications
  add column parent_id uuid null
    references profiles (id) on delete cascade;

create index if not exists idx_notifications_parent
  on public.notifications using btree (parent_id);

-- Backfill parent_id from student_parents (primary contact)
update public.notifications n
set parent_id = sp.parent_id
from public.student_parents sp
where sp.student_id = n.student_id
  and sp.is_primary_contact = true
  and n.parent_id is null;

  CREATE OR REPLACE FUNCTION public.current_parent_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
AS $function$
  SELECT id FROM public.profiles WHERE id = auth.uid() AND role = 'parent';
$function$;

-- ============================================================================
-- MIGRATION: Add school_id to all tables missing multitenancy scope
-- Run in Supabase SQL editor — safe to run in one shot
-- ============================================================================

-- ── 1. ANNOUNCEMENTS ─────────────────────────────────────────────────────────
-- Derives school_id from the author_id profile

ALTER TABLE public.announcements
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.announcements a
SET school_id = p.school_id
FROM public.profiles p
WHERE p.id = a.author_id
  AND a.school_id IS NULL;

ALTER TABLE public.announcements
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_announcements_school
  ON public.announcements (school_id);

-- ── 2. ANNOUNCEMENT_READS ────────────────────────────────────────────────────
-- Derives school_id via announcement

ALTER TABLE public.announcement_reads
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.announcement_reads ar
SET school_id = a.school_id
FROM public.announcements a
WHERE a.id = ar.announcement_id
  AND ar.school_id IS NULL;

ALTER TABLE public.announcement_reads
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_announcement_reads_school
  ON public.announcement_reads (school_id);

-- ── 3. ASSESSMENTS ───────────────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.assessments
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.assessments a
SET school_id = s.school_id
FROM public.students s
WHERE s.id = a.student_id
  AND a.school_id IS NULL;

ALTER TABLE public.assessments
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_assessments_school
  ON public.assessments (school_id);

-- ── 4. ARCHIVED_ASSESSMENTS ──────────────────────────────────────────────────
-- Derives school_id from student; student may be deleted so nullable is correct

ALTER TABLE public.archived_assessments
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE SET NULL;

UPDATE public.archived_assessments aa
SET school_id = s.school_id
FROM public.students s
WHERE s.id = aa.student_id
  AND aa.school_id IS NULL;

CREATE INDEX idx_archived_assessments_school
  ON public.archived_assessments (school_id)
  WHERE school_id IS NOT NULL;

-- ── 5. ASSESSMENT_NARRATIVES ─────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.assessment_narratives
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.assessment_narratives an
SET school_id = s.school_id
FROM public.students s
WHERE s.id = an.student_id
  AND an.school_id IS NULL;

ALTER TABLE public.assessment_narratives
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_assessment_narratives_school
  ON public.assessment_narratives (school_id);

-- ── 6. ATTENDANCE ─────────────────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.attendance
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.attendance att
SET school_id = s.school_id
FROM public.students s
WHERE s.id = att.student_id
  AND att.school_id IS NULL;

ALTER TABLE public.attendance
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_attendance_school
  ON public.attendance (school_id);

-- ── 7. CLASS_TEACHER_ASSIGNMENTS ─────────────────────────────────────────────
-- Derives school_id from classes

ALTER TABLE public.class_teacher_assignments
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.class_teacher_assignments cta
SET school_id = c.school_id
FROM public.classes c
WHERE c.id = cta.class_id
  AND cta.school_id IS NULL;

ALTER TABLE public.class_teacher_assignments
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_cta_school
  ON public.class_teacher_assignments (school_id);

-- ── 8. COMMUNICATION_BOOK ────────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.communication_book
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.communication_book cb
SET school_id = s.school_id
FROM public.students s
WHERE s.id = cb.student_id
  AND cb.school_id IS NULL;

ALTER TABLE public.communication_book
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_communication_book_school
  ON public.communication_book (school_id);

-- ── 9. COMMUNICATIONS_LOG ────────────────────────────────────────────────────
-- Derives school_id from the sender profile

ALTER TABLE public.communications_log
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.communications_log cl
SET school_id = p.school_id
FROM public.profiles p
WHERE p.id = cl.sent_by
  AND cl.school_id IS NULL;

ALTER TABLE public.communications_log
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_communications_log_school
  ON public.communications_log (school_id);

-- ── 10. CSL_LOGBOOK ──────────────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.csl_logbook
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.csl_logbook cl
SET school_id = s.school_id
FROM public.students s
WHERE s.id = cl.student_id
  AND cl.school_id IS NULL;

ALTER TABLE public.csl_logbook
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_csl_logbook_school
  ON public.csl_logbook (school_id);

-- ── 11. FEE_PAYMENTS ─────────────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.fee_payments
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.fee_payments fp
SET school_id = s.school_id
FROM public.students s
WHERE s.id = fp.student_id
  AND fp.school_id IS NULL;

ALTER TABLE public.fee_payments
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_fee_payments_school
  ON public.fee_payments (school_id);

-- ── 12. SCHOOL_EVENTS ────────────────────────────────────────────────────────
-- Derives school_id from author profile

ALTER TABLE public.school_events
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.school_events se
SET school_id = p.school_id
FROM public.profiles p
WHERE p.id = se.author_id
  AND se.school_id IS NULL;

ALTER TABLE public.school_events
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_school_events_school
  ON public.school_events (school_id);

-- ── 13. STUDENT_CONDUCT ──────────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.student_conduct
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.student_conduct sc
SET school_id = s.school_id
FROM public.students s
WHERE s.id = sc.student_id
  AND sc.school_id IS NULL;

ALTER TABLE public.student_conduct
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_student_conduct_school
  ON public.student_conduct (school_id);

-- ── 14. TALENT_GALLERY ───────────────────────────────────────────────────────
-- Student-scoped rows derive from student; class/school rows derive from teacher

ALTER TABLE public.talent_gallery
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

-- Rows linked to a student
UPDATE public.talent_gallery tg
SET school_id = s.school_id
FROM public.students s
WHERE s.id = tg.student_id
  AND tg.school_id IS NULL;

-- Remaining rows (audience = 'class' or 'school') derive from teacher profile
UPDATE public.talent_gallery tg
SET school_id = p.school_id
FROM public.profiles p
WHERE p.id = tg.teacher_id
  AND tg.school_id IS NULL;

ALTER TABLE public.talent_gallery
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_talent_gallery_school
  ON public.talent_gallery (school_id);

-- ── 15. TEACHER_SUBJECT_ALLOCATIONS ─────────────────────────────────────────
-- Derives school_id from classes

ALTER TABLE public.teacher_subject_allocations
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.teacher_subject_allocations tsa
SET school_id = c.school_id
FROM public.classes c
WHERE c.id = tsa.class_id
  AND tsa.school_id IS NULL;

ALTER TABLE public.teacher_subject_allocations
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_teacher_subject_allocations_school
  ON public.teacher_subject_allocations (school_id);

-- ── 16. TIMETABLE_SLOTS ──────────────────────────────────────────────────────
-- Derives school_id from teacher_subject_allocations → classes

ALTER TABLE public.timetable_slots
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.timetable_slots ts
SET school_id = tsa.school_id
FROM public.teacher_subject_allocations tsa
WHERE tsa.id = ts.allocation_id
  AND ts.school_id IS NULL;

ALTER TABLE public.timetable_slots
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_timetable_slots_school
  ON public.timetable_slots (school_id);

-- ── 17. TRANSFER_REQUESTS ────────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.transfer_requests
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.transfer_requests tr
SET school_id = s.school_id
FROM public.students s
WHERE s.id = tr.student_id
  AND tr.school_id IS NULL;

ALTER TABLE public.transfer_requests
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_transfer_requests_school
  ON public.transfer_requests (school_id);

-- ── 18. SUBJECTS ─────────────────────────────────────────────────────────────
-- Subjects are currently global (shared across schools via level).
-- Two valid approaches:
--   A) Keep global, no school_id (CBC subjects are standardised nationally)
--   B) Add school_id to allow per-school customisation
-- We go with B so custom subjects can be scoped, with NULL meaning "global/shared"

ALTER TABLE public.subjects
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

-- No backfill — existing rows are global subjects, school_id stays NULL
-- App logic: fetch WHERE school_id = $school_id OR school_id IS NULL

CREATE INDEX idx_subjects_school
  ON public.subjects (school_id)
  WHERE school_id IS NOT NULL;

-- ── 19. SCHOOL_SETTINGS ──────────────────────────────────────────────────────
-- Already school-specific by design (one row per school intended).
-- The singleton index enforces one row total which breaks multitenancy.
-- We replace it with a per-school unique constraint.

ALTER TABLE public.school_settings
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

-- Drop the global singleton index
DROP INDEX IF EXISTS school_settings_singleton;

-- Each school gets exactly one settings row
ALTER TABLE public.school_settings
  ADD CONSTRAINT school_settings_school_id_key UNIQUE (school_id);

-- Backfill: if only one school exists this resolves cleanly
UPDATE public.school_settings ss
SET school_id = (SELECT id FROM public.schools LIMIT 1)
WHERE ss.school_id IS NULL;

ALTER TABLE public.school_settings
  ALTER COLUMN school_id SET NOT NULL;

-- ── 20. SYSTEM_SETTINGS ──────────────────────────────────────────────────────
-- Same pattern as school_settings — currently a global singleton (id = 1).
-- For multitenancy, replace the id=1 check with per-school rows.

ALTER TABLE public.system_settings
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

DROP INDEX IF EXISTS system_settings_singleton;

ALTER TABLE public.system_settings
  ADD CONSTRAINT system_settings_school_id_key UNIQUE (school_id);

-- Remove the id=1 singleton constraint since we now scope by school
ALTER TABLE public.system_settings
  DROP CONSTRAINT IF EXISTS system_settings_id_check;

UPDATE public.system_settings ss
SET school_id = (SELECT id FROM public.schools LIMIT 1)
WHERE ss.school_id IS NULL;

ALTER TABLE public.system_settings
  ALTER COLUMN school_id SET NOT NULL;

-- ── VERIFICATION ─────────────────────────────────────────────────────────────
-- Run after migration to confirm zero tables are still missing school_id

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'school_id'
  )
ORDER BY table_name;


-- ============================================================================
-- MIGRATION 2: school_id for remaining tables + RLS policies for classes
--              and notifications
-- Run AFTER migration 1
-- ============================================================================

-- ── 1. FEE_STRUCTURES ────────────────────────────────────────────────────────
-- Fee structures are school-specific (different schools charge different fees)
-- Derives from created_by profile; existing unique constraint on
-- (grade, term, academic_year) must be dropped and rebuilt with school_id

ALTER TABLE public.fee_structures
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.fee_structures fs
SET school_id = p.school_id
FROM public.profiles p
WHERE p.id = fs.created_by
  AND fs.school_id IS NULL;

-- If created_by is null on any rows, fall back to the single school
UPDATE public.fee_structures
SET school_id = (SELECT id FROM public.schools LIMIT 1)
WHERE school_id IS NULL;

ALTER TABLE public.fee_structures
  ALTER COLUMN school_id SET NOT NULL;

-- Rebuild unique constraint to be scoped per school
ALTER TABLE public.fee_structures
  DROP CONSTRAINT IF EXISTS fee_structures_grade_term_academic_year_key,
  DROP CONSTRAINT IF EXISTS uq_fee_structure_grade_term_year;

ALTER TABLE public.fee_structures
  ADD CONSTRAINT uq_fee_structure_school_grade_term_year
    UNIQUE (school_id, grade, term, academic_year);

CREATE INDEX idx_fee_structures_school
  ON public.fee_structures (school_id);

-- ── 2. HISTORICAL_SBA_OVERRIDES ──────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.historical_sba_overrides
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.historical_sba_overrides h
SET school_id = s.school_id
FROM public.students s
WHERE s.id = h.student_id
  AND h.school_id IS NULL;

ALTER TABLE public.historical_sba_overrides
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_historical_sba_overrides_school
  ON public.historical_sba_overrides (school_id);

-- ── 3. INVENTORY_ITEMS ───────────────────────────────────────────────────────
-- Inventory is per-school. No FK to derive from so we use the single school.
-- The SKU unique constraint must be scoped per school too.

ALTER TABLE public.inventory_items
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.inventory_items
SET school_id = (SELECT id FROM public.schools LIMIT 1)
WHERE school_id IS NULL;

ALTER TABLE public.inventory_items
  ALTER COLUMN school_id SET NOT NULL;

-- SKU uniqueness should be per school, not global
ALTER TABLE public.inventory_items
  DROP CONSTRAINT IF EXISTS inventory_items_sku_key;

ALTER TABLE public.inventory_items
  ADD CONSTRAINT uq_inventory_sku_per_school
    UNIQUE (school_id, sku);

CREATE INDEX idx_inventory_items_school
  ON public.inventory_items (school_id);

-- ── 4. INVENTORY_TRANSACTIONS ────────────────────────────────────────────────
-- Derives school_id from inventory_items

ALTER TABLE public.inventory_transactions
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.inventory_transactions it
SET school_id = ii.school_id
FROM public.inventory_items ii
WHERE ii.id = it.item_id
  AND it.school_id IS NULL;

ALTER TABLE public.inventory_transactions
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_inventory_transactions_school
  ON public.inventory_transactions (school_id);

-- ── 5. JSS_PATHWAYS ──────────────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.jss_pathways
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.jss_pathways jp
SET school_id = s.school_id
FROM public.students s
WHERE s.id = jp.student_id
  AND jp.school_id IS NULL;

ALTER TABLE public.jss_pathways
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_jss_pathways_school
  ON public.jss_pathways (school_id);

-- ── 6. LESSON_PLANS ──────────────────────────────────────────────────────────
-- Derives school_id from teacher profile

ALTER TABLE public.lesson_plans
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.lesson_plans lp
SET school_id = p.school_id
FROM public.profiles p
WHERE p.id = lp.teacher_id
  AND lp.school_id IS NULL;

ALTER TABLE public.lesson_plans
  ALTER COLUMN school_id SET NOT NULL;

-- Rebuild unique constraint scoped per school
ALTER TABLE public.lesson_plans
  DROP CONSTRAINT IF EXISTS lesson_plans_teacher_id_subject_name_grade_academic_year_te_key;

ALTER TABLE public.lesson_plans
  ADD CONSTRAINT uq_lesson_plan_per_school
    UNIQUE (school_id, teacher_id, subject_name, grade, academic_year, term, week_number);

CREATE INDEX idx_lesson_plans_school
  ON public.lesson_plans (school_id);

-- ── 7. PARENT_NOTIFICATIONS ──────────────────────────────────────────────────
-- Derives school_id from student

ALTER TABLE public.parent_notifications
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.parent_notifications pn
SET school_id = s.school_id
FROM public.students s
WHERE s.id = pn.student_id
  AND pn.school_id IS NULL;

ALTER TABLE public.parent_notifications
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_parent_notifications_school
  ON public.parent_notifications (school_id);

-- ── 8. PUBLIC_APPLICATIONS ───────────────────────────────────────────────────
-- Applications are submitted to a specific school.
-- No FK to derive from; reviewers belong to a school so we can use that,
-- but unreviewed applications (reviewed_by IS NULL) need the fallback.

ALTER TABLE public.public_applications
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.public_applications pa
SET school_id = p.school_id
FROM public.profiles p
WHERE p.id = pa.reviewed_by
  AND pa.school_id IS NULL;

-- Pending/unreviewed applications fall back to single school
UPDATE public.public_applications
SET school_id = (SELECT id FROM public.schools LIMIT 1)
WHERE school_id IS NULL;

ALTER TABLE public.public_applications
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_public_applications_school
  ON public.public_applications (school_id);

-- ── 9. PERMISSION_CATALOG ────────────────────────────────────────────────────
-- Permission definitions are platform-global, not school-scoped.
-- A permission like "people:students:read" means the same thing in every school.
-- No school_id needed — this is a lookup/reference table.
-- (no changes)

-- ── 10. PERMISSIONS ──────────────────────────────────────────────────────────
-- Same as permission_catalog — platform-global reference data.
-- No school_id needed.
-- (no changes)

-- ── 11. ROLE_PERMISSIONS ─────────────────────────────────────────────────────
-- Links roles to permissions. Roles reference the `roles` table.
-- If roles are school-scoped then role_permissions inherits that scope
-- transitively via role_id. No direct school_id column needed here
-- unless you want to allow school-level permission overrides on roles,
-- which is out of scope for now.
-- (no changes)

-- ── 12. USER_PERMISSIONS ─────────────────────────────────────────────────────
-- Per-teacher permission overrides. teacher_id → profiles → school_id
-- gives us the school scope transitively. However adding school_id
-- directly enables efficient RLS policies without a join.

ALTER TABLE public.user_permissions
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.user_permissions up
SET school_id = p.school_id
FROM public.profiles p
WHERE p.id = up.teacher_id
  AND up.school_id IS NULL;

ALTER TABLE public.user_permissions
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_user_permissions_school
  ON public.user_permissions (school_id);

-- ── 13. USER_ROLES ───────────────────────────────────────────────────────────
-- Same reasoning as user_permissions

ALTER TABLE public.user_roles
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

UPDATE public.user_roles ur
SET school_id = p.school_id
FROM public.profiles p
WHERE p.id = ur.teacher_id
  AND ur.school_id IS NULL;

ALTER TABLE public.user_roles
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_user_roles_school
  ON public.user_roles (school_id);

-- ============================================================================
-- RLS POLICIES — CLASSES
-- Has school_id but no policies yet
-- ============================================================================

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes FORCE ROW LEVEL SECURITY;

-- Staff and admins within the same school can read classes
CREATE POLICY "classes_school_read"
  ON public.classes
  FOR SELECT
  USING (
    school_id = (
      SELECT school_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- Only admins can insert/update/delete classes
CREATE POLICY "classes_admin_insert"
  ON public.classes
  FOR INSERT
  WITH CHECK (
    school_id = (
      SELECT school_id FROM public.profiles
      WHERE id = auth.uid()
    )
    AND (
      (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
      OR (SELECT is_dev FROM public.profiles WHERE id = auth.uid()) = true
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  );

CREATE POLICY "classes_admin_update"
  ON public.classes
  FOR UPDATE
  USING (
    school_id = (
      SELECT school_id FROM public.profiles
      WHERE id = auth.uid()
    )
    AND (
      (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
      OR (SELECT is_dev FROM public.profiles WHERE id = auth.uid()) = true
      OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  );

CREATE POLICY "classes_admin_delete"
  ON public.classes
  FOR DELETE
  USING (
    (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
    OR (SELECT is_dev FROM public.profiles WHERE id = auth.uid()) = true
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
      AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ============================================================================
-- RLS POLICIES — NOTIFICATIONS
-- Has school_id but no policies yet
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

-- Parents read notifications addressed to them or their children
CREATE POLICY "notifications_parent_read"
  ON public.notifications
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (
      parent_id = auth.uid()
      OR student_id IN (
        SELECT student_id FROM public.student_parents
        WHERE parent_id = auth.uid()
      )
    )
  );

-- Staff read all notifications within their school
CREATE POLICY "notifications_staff_read"
  ON public.notifications
  FOR SELECT
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('admin', 'staff')
  );

-- Sender (teacher/system) can insert notifications for their school
CREATE POLICY "notifications_insert"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

-- Parents can mark their own notifications as read
CREATE POLICY "notifications_parent_update_read"
  ON public.notifications
  FOR UPDATE
  USING (
    parent_id = auth.uid()
    OR student_id IN (
      SELECT student_id FROM public.student_parents
      WHERE parent_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Should return zero rows if all tables now have school_id
-- (excluding known global tables: permission_catalog, permissions,
--  role_permissions, schools itself)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND table_name NOT IN (
    'permission_catalog', 'permissions', 'role_permissions',
    'roles', 'schools', 'schema_migrations'
  )
  AND table_name NOT IN (
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'school_id'
  )
ORDER BY table_name;


-- ============================================================================
-- MIGRATION: student_diary — add school_id + enable RLS + write policies
-- ============================================================================

-- ── 1. Add school_id ──────────────────────────────────────────────────────────

ALTER TABLE public.student_diary
  ADD COLUMN school_id uuid NULL
    REFERENCES public.schools (id) ON DELETE CASCADE;

-- Observations are student-scoped → derive from students
UPDATE public.student_diary sd
SET school_id = s.school_id
FROM public.students s
WHERE s.id = sd.student_id
  AND sd.school_id IS NULL;

-- Homework/notice entries are class-scoped → derive from classes
UPDATE public.student_diary sd
SET school_id = c.school_id
FROM public.classes c
WHERE c.id = sd.class_id
  AND sd.school_id IS NULL;

-- Sanity check before locking down — should return 0
SELECT COUNT(*) AS unresolved_rows
FROM public.student_diary
WHERE school_id IS NULL;

-- Once the above returns 0, run:
ALTER TABLE public.student_diary
  ALTER COLUMN school_id SET NOT NULL;

CREATE INDEX idx_student_diary_school
  ON public.student_diary (school_id);

-- ── 2. Enable RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.student_diary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_diary FORCE ROW LEVEL SECURITY;

-- ── 3. Policies ───────────────────────────────────────────────────────────────

-- TEACHERS: read all diary entries within their school
-- (they need to see class homework + observations for their students)
CREATE POLICY "diary_staff_read"
  ON public.student_diary
  FOR SELECT
  USING (
    school_id = (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('staff', 'admin')
  );

-- TEACHERS: insert entries they authored, scoped to their school
CREATE POLICY "diary_staff_insert"
  ON public.student_diary
  FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND school_id = (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) IN ('staff', 'admin')
  );

-- TEACHERS: update only their own entries
CREATE POLICY "diary_staff_update"
  ON public.student_diary
  FOR UPDATE
  USING (
    author_id = auth.uid()
    AND school_id = (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    AND school_id = (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- TEACHERS: delete only their own entries
CREATE POLICY "diary_staff_delete"
  ON public.student_diary
  FOR DELETE
  USING (
    author_id = auth.uid()
    AND school_id = (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- ADMINS: full delete rights within their school
-- (separate from teacher delete so admins can remove any entry)
CREATE POLICY "diary_admin_delete"
  ON public.student_diary
  FOR DELETE
  USING (
    school_id = (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      (SELECT is_super_admin FROM public.profiles WHERE id = auth.uid()) = true
      OR (SELECT is_dev       FROM public.profiles WHERE id = auth.uid()) = true
      OR (SELECT role         FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- PARENTS: read homework + notice entries for their children's class,
--          and observations addressed directly to their children
CREATE POLICY "diary_parent_read"
  ON public.student_diary
  FOR SELECT
  USING (
    school_id = (
      SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
    AND (
      SELECT role FROM public.profiles WHERE id = auth.uid()
    ) = 'parent'
    AND (
      -- Class-scoped entries: parent's child is in that class
      (
        entry_type IN ('homework', 'notice')
        AND class_id IN (
          SELECT s.class_id
          FROM public.students s
          JOIN public.student_parents sp ON sp.student_id = s.id
          WHERE sp.parent_id = auth.uid()
            AND s.class_id IS NOT NULL
        )
      )
      OR
      -- Observation entries: directly about their child
      (
        entry_type = 'observation'
        AND student_id IN (
          SELECT student_id
          FROM public.student_parents
          WHERE parent_id = auth.uid()
        )
      )
    )
  );

-- PARENTS: mark homework as completed for their own children
CREATE POLICY "diary_parent_update_completed"
  ON public.student_diary
  FOR UPDATE
  USING (
    entry_type = 'homework'
    AND student_id IN (
      SELECT student_id
      FROM public.student_parents
      WHERE parent_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- ── 4. Verification ───────────────────────────────────────────────────────────

-- Confirm RLS is active
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'student_diary'
  AND relnamespace = 'public'::regnamespace;

-- Confirm all 6 policies exist
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'student_diary'
ORDER BY policyname;

ALTER TABLE public.class_teacher_assignments
ADD CONSTRAINT class_teacher_assignments_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;

ALTER TABLE public.teacher_subject_allocations
ADD CONSTRAINT teacher_subject_allocations_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;

-- Index for quick lookups by teacher
CREATE INDEX IF NOT EXISTS idx_tsa_teacher_id 
ON public.teacher_subject_allocations USING btree (teacher_id);

-- Index for class-level breakdowns and checking active statuses
CREATE INDEX IF NOT EXISTS idx_tsa_class_active 
ON public.teacher_subject_allocations USING btree (class_id, is_active);

-- Clean slate: remove previous rough-draft structural attempts
DROP POLICY IF EXISTS "Allow school admins to manage allocations" ON public.teacher_subject_allocations;
DROP POLICY IF EXISTS "Allow authorized school management to handle allocations" ON public.teacher_subject_allocations;

-- Create the refined dynamic permission isolation bounds rule
CREATE POLICY "Enforce dynamic permission boundaries on allocation changes" 
ON public.teacher_subject_allocations
FOR ALL 
TO authenticated
USING (
  -- 1. Global Bypass Escape-Hatch: Let Devs/Super Admins manage across structural boundaries
  (SELECT is_super_admin OR is_dev FROM public.profiles WHERE id = auth.uid()) = true
  OR
  (
    -- 2. Multi-Tenant School Context Isolation Enforcement
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND 
    -- 3. Granular Action Level Permission Flag Assertions
    'manage_allocations' = ANY (
      SELECT unnest(allowed_permissions_override) 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
)
WITH CHECK (
  -- Mirror checks strictly to safe-guard creation operations against arbitrary data injection
  (SELECT is_super_admin OR is_dev FROM public.profiles WHERE id = auth.uid()) = true
  OR
  (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND 
    'manage_allocations' = ANY (
      SELECT unnest(allowed_permissions_override) 
      FROM public.profiles 
      WHERE id = auth.uid()
    )
  )
);