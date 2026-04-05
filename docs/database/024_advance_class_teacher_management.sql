-- 1. Create the classes table
CREATE TABLE IF NOT EXISTS public.classes (
    id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
    grade text NOT NULL,
    stream text NOT NULL DEFAULT 'Main',
    academic_year integer NOT NULL DEFAULT 2026,
    level text NOT NULL,
    created_at timestamptz DEFAULT now(),
    
    CONSTRAINT classes_pkey PRIMARY KEY (id),
    CONSTRAINT uq_class_grade_stream_year UNIQUE (grade, stream, academic_year),
    CONSTRAINT classes_level_check CHECK (level = ANY (ARRAY['lower_primary', 'upper_primary', 'junior_secondary']))
);

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_classes_lookup ON public.classes (grade, stream, academic_year);

-- This inserts a 'Main' stream for every unique grade currently in your system
INSERT INTO public.classes (grade, stream, academic_year, level)
SELECT DISTINCT 
    grade, 
    'Main' as stream, 
    academic_year,
    CASE 
        WHEN grade ILIKE 'Grade 1%' OR grade ILIKE 'Grade 2%' OR grade ILIKE 'Grade 3%' THEN 'lower_primary'
        WHEN grade ILIKE 'Grade 4%' OR grade ILIKE 'Grade 5%' OR grade ILIKE 'Grade 6%' THEN 'upper_primary'
        ELSE 'junior_secondary'
    END as level
FROM public.class_teacher_assignments
ON CONFLICT DO NOTHING;

-- 1. Add the new columns
ALTER TABLE public.class_teacher_assignments 
ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS assigned_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS relieved_at timestamptz NULL;

-- 2. Link the existing data to the new class IDs
UPDATE public.class_teacher_assignments cta
SET class_id = c.id
FROM public.classes c
WHERE cta.grade = c.grade 
AND cta.academic_year = c.academic_year;

-- 3. Cleanup: Remove the old unique constraint and grade column
-- Note: Replace 'uq_class_teacher_grade_year' with your actual constraint name if different
ALTER TABLE public.class_teacher_assignments DROP CONSTRAINT IF EXISTS uq_class_teacher_grade_year;
ALTER TABLE public.class_teacher_assignments DROP COLUMN IF EXISTS grade;

-- 4. Add the "The Highlander" Rule (Only one active teacher per class)
CREATE UNIQUE INDEX idx_one_active_teacher_per_class 
ON public.class_teacher_assignments (class_id) 
WHERE (is_active = true);

-- 1. Add class_id column
ALTER TABLE public.teacher_subject_allocations 
ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;

-- 2. Map existing data
UPDATE public.teacher_subject_allocations tsa
SET class_id = c.id
FROM public.classes c
WHERE tsa.grade = c.grade 
AND tsa.academic_year = c.academic_year;

-- 3. Cleanup: Drop old grade column
ALTER TABLE public.teacher_subject_allocations DROP COLUMN IF EXISTS grade;

-- 1. Enable RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- 2. View Policy: Everyone authenticated (Teachers & Admins) can see classes
CREATE POLICY "Allow authenticated users to view classes" 
ON public.classes
FOR SELECT 
TO authenticated
USING (true);

-- 3. Insert Policy: Only Admins and Superadmins can create classes
CREATE POLICY "Allow admins to insert classes" 
ON public.classes
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- 4. Update Policy: Only Admins and Superadmins can modify class details
CREATE POLICY "Allow admins to update classes" 
ON public.classes
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- 5. Delete Policy: Only Superadmins can delete a class 
-- (Safeguard: Deleting a class cascades to all assignments!)
CREATE POLICY "Allow superadmins to delete classes" 
ON public.classes
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
    AND role = 'superadmin'
  )
);

TRUNCATE TABLE public.class_teacher_assignments RESTART IDENTITY;