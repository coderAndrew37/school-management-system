-- Add status column to teachers table
ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'on_leave', 'resigned', 'terminated'));

CREATE INDEX IF NOT EXISTS idx_teachers_status ON teachers (status);