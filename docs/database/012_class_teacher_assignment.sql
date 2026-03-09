

-- ── 1. class_teacher_assignments ─────────────────────────────────────────────
-- One class teacher per grade per academic year.
-- A teacher can be class teacher of multiple grades (e.g. small school).
-- A grade can only have ONE class teacher per year (enforced by unique).

create table if not exists public.class_teacher_assignments (
  id           uuid        primary key default extensions.uuid_generate_v4(),
  teacher_id   uuid        not null references public.teachers(id) on delete cascade,
  grade        text        not null,
  academic_year integer    not null default 2026,
  assigned_by  uuid        references auth.users(id),   -- admin who made the assignment
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint uq_class_teacher_grade_year unique (grade, academic_year)
);

comment on table public.class_teacher_assignments is
  'Assigns one class teacher per grade per academic year. '
  'Class teachers own attendance, aggregated reports, and class-wide comms.';

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_class_teacher_updated_at
  before update on public.class_teacher_assignments
  for each row execute function public.set_updated_at();

-- ── 2. parent_notifications ───────────────────────────────────────────────────
-- Audit log of every email/SMS sent to a parent.
-- Written by server actions after Resend/AT calls succeed or fail.

create table if not exists public.parent_notifications (
  id           uuid        primary key default extensions.uuid_generate_v4(),
  student_id   uuid        not null references public.students(id) on delete cascade,
  parent_id    uuid        references public.parents(id),
  channel      text        not null check (channel in ('email', 'sms', 'both')),
  event_type   text        not null,
  -- event_type values: 'absent' | 'late' | 'new_message' | 'new_diary'
  --                    | 'report_ready' | 'announcement' | 'homework'
  subject      text,
  body         text        not null,
  sent_at      timestamptz not null default now(),
  status       text        not null default 'sent'
                check (status in ('sent', 'failed', 'pending')),
  error_msg    text
);

comment on table public.parent_notifications is
  'Audit log of email/SMS notifications sent to parents. '
  'Written by server actions; never written directly by clients.';

-- ── 3. RLS policies ──────────────────────────────────────────────────────────

alter table public.class_teacher_assignments enable row level security;
alter table public.parent_notifications       enable row level security;

-- Admins can do anything on class_teacher_assignments
create policy "Admins manage class teacher assignments"
  on public.class_teacher_assignments
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin')
    )
  );

-- Teachers can read their own assignment
create policy "Teachers read own class assignment"
  on public.class_teacher_assignments
  for select
  using (teacher_id = auth.uid());

-- Service role bypasses RLS (for server actions writing notification logs)
-- parent_notifications: admins + the teacher who triggered it can read
create policy "Admins read all notifications"
  on public.parent_notifications
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin')
    )
  );

-- Parents can read notifications about their own children
create policy "Parents read own child notifications"
  on public.parent_notifications
  for select
  using (
    parent_id = auth.uid()
    or exists (
      select 1 from public.student_parents sp
      where sp.student_id = parent_notifications.student_id
        and sp.parent_id  = auth.uid()
    )
  );

-- ── 4. Indexes ────────────────────────────────────────────────────────────────

create index if not exists idx_cta_teacher_id
  on public.class_teacher_assignments(teacher_id);

create index if not exists idx_cta_grade_year
  on public.class_teacher_assignments(grade, academic_year);

create index if not exists idx_pn_student_id
  on public.parent_notifications(student_id);

create index if not exists idx_pn_parent_id
  on public.parent_notifications(parent_id);

create index if not exists idx_pn_event_type
  on public.parent_notifications(event_type);

-- ── 5. Helper function: is_class_teacher(grade) ──────────────────────────────
-- Used in RLS on other tables later (e.g. attendance) to allow class teachers
-- to read/write their whole class without needing subject allocations.

create or replace function public.is_class_teacher_of(p_grade text)
returns boolean
language sql stable security definer as $$
  select exists (
    select 1
    from   public.class_teacher_assignments
    where  teacher_id    = auth.uid()
      and  grade         = p_grade
      and  academic_year = extract(year from now())::int
  );
$$;

comment on function public.is_class_teacher_of is
  'Returns true if the current user is the class teacher for the given grade '
  'in the current academic year. Used in RLS policies.';

  -- 1. Create the custom attendance status type
CREATE TYPE attendance_status AS ENUM ('Present', 'Absent', 'Late', 'Excused');

-- 2. Drop the existing check constraint from your table
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_status_check;

-- 3. Change the column type to use the new ENUM
-- We use USING status::attendance_status to cast existing data to the new type
ALTER TABLE public.attendance 
ALTER COLUMN status TYPE attendance_status 
USING status::attendance_status;