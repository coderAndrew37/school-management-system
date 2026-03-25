-- ── Migration: student_conduct table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_conduct (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id      UUID NOT NULL REFERENCES teachers(id),
  grade           TEXT NOT NULL,
  academic_year   INTEGER NOT NULL DEFAULT 2026,
  term            INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
  type            TEXT NOT NULL CHECK (type IN ('merit', 'demerit', 'incident')),
  category        TEXT NOT NULL,
  -- Categories: 'academic' | 'behaviour' | 'leadership' | 'sport' | 'community' | 'other'
  points          INTEGER NOT NULL DEFAULT 0,
  -- Positive for merits, negative for demerits, 0 for incidents
  description     TEXT NOT NULL,
  action_taken    TEXT,
  -- What the teacher did / plans to do (detention, counselling, praise, etc.)
  parent_notified BOOLEAN NOT NULL DEFAULT FALSE,
  parent_ack_at   TIMESTAMPTZ,
  -- Timestamp when parent clicked "Acknowledge" in the portal
  severity        TEXT CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'low',
  -- Only relevant for incidents
  is_resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conduct_student   ON student_conduct (student_id);
CREATE INDEX IF NOT EXISTS idx_conduct_teacher   ON student_conduct (teacher_id);
CREATE INDEX IF NOT EXISTS idx_conduct_grade     ON student_conduct (grade, academic_year, term);
CREATE INDEX IF NOT EXISTS idx_conduct_type      ON student_conduct (type);

-- RLS
ALTER TABLE student_conduct ENABLE ROW LEVEL SECURITY;

-- Teachers read/write their own records
CREATE POLICY "conduct: teacher own"
  ON student_conduct FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Admins read all
CREATE POLICY "conduct: admin read"
  ON student_conduct FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')
  ));

-- Parents read their child's records (non-incident only, or resolved incidents)
CREATE POLICY "conduct: parent read"
  ON student_conduct FOR SELECT
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = auth.uid()
    )
    AND (type != 'incident' OR is_resolved = true OR parent_notified = true)
  );

-- Parents update parent_ack_at on their child's records
CREATE POLICY "conduct: parent acknowledge"
  ON student_conduct FOR UPDATE
  USING (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id IN (
      SELECT student_id FROM student_parents WHERE parent_id = auth.uid()
    )
  );

-- ── Migration: lesson_plans table ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lesson_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES teachers(id),
  subject_id      UUID REFERENCES subjects(id),
  subject_name    TEXT NOT NULL,
  grade           TEXT NOT NULL,
  academic_year   INTEGER NOT NULL DEFAULT 2026,
  term            INTEGER NOT NULL CHECK (term IN (1, 2, 3)),
  week_number     INTEGER NOT NULL CHECK (week_number BETWEEN 1 AND 18),
  topic           TEXT NOT NULL,
  strand_id       TEXT,
  -- The CBC strand being covered this week
  objectives      TEXT,
  -- What learners should be able to do by end of week
  activities      TEXT,
  -- Teaching activities, methods, resources
  resources       TEXT,
  -- Materials needed (textbooks, manipulatives, etc.)
  assessment_note TEXT,
  -- How the teacher plans to assess this topic
  status          TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'taught', 'skipped')),
  taught_at       DATE,
  -- Actual date taught (may differ from planned week)
  notes           TEXT,
  -- Post-lesson reflection notes
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (teacher_id, subject_name, grade, academic_year, term, week_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_plans_teacher ON lesson_plans (teacher_id);
CREATE INDEX IF NOT EXISTS idx_plans_grade   ON lesson_plans (grade, academic_year, term);

-- RLS
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans: teacher own"
  ON lesson_plans FOR ALL
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "plans: admin read"
  ON lesson_plans FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','superadmin')
  ));