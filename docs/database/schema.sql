-- 1. EXTENSIONS (Good practice)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TEACHERS TABLE
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  tsc_number TEXT UNIQUE, -- Mandatory for Kenyan schools
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PARENTS TABLE (The Portal Owners)
CREATE TABLE parents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT NOT NULL, -- Used for M-Pesa/SMS later
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. STUDENTS TABLE (Linked to Parents)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  readable_id TEXT UNIQUE, -- e.g., KIB-2026-0001
  upi_number TEXT UNIQUE, -- Government NEMIS ID
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT CHECK (gender IN ('Male', 'Female')),
  current_grade TEXT NOT NULL, -- e.g., 'Grade 4', 'JSS 1'
  parent_id UUID REFERENCES parents(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CBC ASSESSMENTS TABLE (The Teacher's Input)
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES teachers(id),
  subject_name TEXT NOT NULL, -- e.g., 'Integrated Science'
  strand_id TEXT NOT NULL, -- Fetched from Sanity (e.g., 'human-anatomy')
  score TEXT CHECK (score IN ('EE', 'ME', 'AE', 'BE')), -- CBC Standard
  evidence_url TEXT, -- Link to photo in Supabase Storage
  teacher_remarks TEXT,
  term INTEGER CHECK (term IN (1, 2, 3)),
  academic_year INTEGER DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a sequence for the numbers
CREATE SEQUENCE student_id_seq;

-- Function to format the ID
CREATE OR REPLACE FUNCTION generate_readable_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.readable_id := 'KIB-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('student_id_seq')::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the students table
CREATE TRIGGER trg_generate_id
BEFORE INSERT ON students
FOR EACH ROW
WHEN (NEW.readable_id IS NULL)
EXECUTE FUNCTION generate_readable_id();