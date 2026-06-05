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