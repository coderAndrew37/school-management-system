-- 1. If you have old test data, it's safest to clear it 
-- (Only do this if you don't mind losing current test allocations)
TRUNCATE TABLE public.teacher_subject_allocations CASCADE;

-- 2. Now add the constraint safely
ALTER TABLE public.teacher_subject_allocations 
ALTER COLUMN class_id SET NOT NULL;

-- 3. Add a Unique Constraint to prevent double-allocating 
-- a subject to different teachers in the SAME class
ALTER TABLE public.teacher_subject_allocations
ADD CONSTRAINT uq_teacher_subject_class_year 
UNIQUE (subject_id, class_id, academic_year);s