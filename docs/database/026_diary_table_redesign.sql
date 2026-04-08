-- 1. NUKE IT
DROP TABLE IF EXISTS public.student_diary CASCADE;

-- 2. BUILD IT PRO
CREATE TABLE public.student_diary (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  
  -- Relations
  class_id uuid NULL,      -- Ties to classes table (Homework/Notices)
  student_id uuid NULL,    -- Ties to students table (Observations)
  author_id uuid NULL,     -- Ties to profiles table (The Teacher/Staff)

  -- Content
  title text NOT NULL,
  content text NULL,
  entry_type text NOT NULL DEFAULT 'homework'::text,
  subject_name text NULL,  -- e.g., 'Mathematics', 'Science'
  
  -- Logic & Scheduling
  due_date date NULL,      -- Relevant for homework
  is_completed boolean NULL DEFAULT false,
  
  -- Metadata
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT student_diary_pkey PRIMARY KEY (id),
  
  -- Foreign Keys
  CONSTRAINT student_diary_class_id_fkey 
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  CONSTRAINT student_diary_student_id_fkey 
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT student_diary_author_id_fkey 
    FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE SET NULL,

  -- THE CORE BUSINESS LOGIC (Nuke-Proof Scope)
  CONSTRAINT chk_diary_scope CHECK (
    (entry_type = 'observation' AND student_id IS NOT NULL AND class_id IS NULL) OR 
    (entry_type IN ('homework', 'notice') AND class_id IS NOT NULL AND student_id IS NULL)
  ),

  -- Type Guard
  CONSTRAINT student_diary_entry_type_check CHECK (
    entry_type = ANY (ARRAY['homework', 'notice', 'observation'])
  )
) TABLESPACE pg_default;

-- 3. INDEXING
CREATE INDEX idx_student_diary_class_id ON public.student_diary(class_id);
CREATE INDEX idx_student_diary_student_id ON public.student_diary(student_id);
CREATE INDEX idx_student_diary_entry_type ON public.student_diary(entry_type);