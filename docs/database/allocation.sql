-- ============================================================
-- MIGRATION: Subject Allocation & Timetable Generation
-- Kibera Academy CBC School Management System
-- ============================================================

-- 1. CBC SUBJECTS REFERENCE TABLE
--    Pre-seeded with Kenya's CBC curriculum subjects per level
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,          -- e.g. 'MATH', 'ENG', 'ISC'
  level TEXT NOT NULL                 -- 'lower_primary' | 'upper_primary' | 'junior_secondary'
    CHECK (level IN ('lower_primary', 'upper_primary', 'junior_secondary')),
  weekly_lessons INTEGER NOT NULL DEFAULT 5, -- lessons per week for timetable gen
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TEACHER–SUBJECT ALLOCATIONS
--    One teacher can be allocated many subject+grade combos
--    One subject+grade combo can only have ONE teacher (unique constraint)
CREATE TABLE IF NOT EXISTS teacher_subject_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,                -- e.g. 'Grade 4', 'JSS 1'
  academic_year INTEGER NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subject_id, grade, academic_year) -- one teacher per subject per grade per year
);

-- 3. TIMETABLE SLOTS
--    Generated schedule — each row is one lesson in the week
CREATE TABLE IF NOT EXISTS timetable_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  allocation_id UUID NOT NULL REFERENCES teacher_subject_allocations(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 5), -- 1=Mon … 5=Fri
  period INTEGER NOT NULL CHECK (period BETWEEN 1 AND 8),           -- up to 8 periods/day
  academic_year INTEGER NOT NULL DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (grade, day_of_week, period, academic_year) -- no double-booking a grade's slot
);

-- ============================================================
-- SEED: CBC Subjects
-- ============================================================

INSERT INTO subjects (name, code, level, weekly_lessons) VALUES
  -- Lower Primary (PP1, PP2, Grade 1–3)
  ('Literacy Activities',        'LIT',  'lower_primary',    6),
  ('Kiswahili Language Activities', 'KIS', 'lower_primary',  5),
  ('Mathematical Activities',    'MATH', 'lower_primary',    5),
  ('Environmental Activities',   'ENV',  'lower_primary',    3),
  ('Creative Arts & Crafts',     'CRT',  'lower_primary',    3),
  ('Music & Movement',           'MUS',  'lower_primary',    2),
  ('Religious Education',        'RE',   'lower_primary',    2),
  ('Physical Education',         'PE',   'lower_primary',    2),

  -- Upper Primary (Grade 4–6)
  ('English',                    'ENG',  'upper_primary',    5),
  ('Kiswahili',                  'KISW', 'upper_primary',    4),
  ('Mathematics',                'MATHU','upper_primary',    5),
  ('Integrated Science',         'ISC',  'upper_primary',    4),
  ('Social Studies',             'SST',  'upper_primary',    3),
  ('Creative Arts',              'CRTU', 'upper_primary',    2),
  ('Music',                      'MUSU', 'upper_primary',    2),
  ('Physical Education',         'PEU',  'upper_primary',    2),
  ('Life Skills',                'LSK',  'upper_primary',    2),
  ('Religious Education',        'REU',  'upper_primary',    1),

  -- Junior Secondary (Grade 7–9 / JSS 1–3)
  ('English & Literature',       'ENGJ', 'junior_secondary', 5),
  ('Kiswahili & Kenya Sign Language', 'KISJ', 'junior_secondary', 4),
  ('Mathematics',                'MATHJ','junior_secondary', 5),
  ('Integrated Science',         'ISCJ', 'junior_secondary', 4),
  ('Social Studies',             'SSTJ', 'junior_secondary', 3),
  ('Business Studies',           'BUS',  'junior_secondary', 3),
  ('Agriculture',                'AGR',  'junior_secondary', 3),
  ('Pre-Technical Studies',      'PTS',  'junior_secondary', 3),
  ('Creative Arts & Sports',     'CAS',  'junior_secondary', 2),
  ('Life Skills & Values',       'LSV',  'junior_secondary', 2),
  ('Religious Education',        'REJ',  'junior_secondary', 1)
ON CONFLICT (code) DO NOTHING;