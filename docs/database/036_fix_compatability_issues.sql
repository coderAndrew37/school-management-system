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