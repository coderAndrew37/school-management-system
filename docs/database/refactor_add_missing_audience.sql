-- Add missing columns to school_events
ALTER TABLE school_events
  ADD COLUMN IF NOT EXISTS audience     TEXT NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'parents', 'teachers', 'students')),
  ADD COLUMN IF NOT EXISTS target_grade TEXT;