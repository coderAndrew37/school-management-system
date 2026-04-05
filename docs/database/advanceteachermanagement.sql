-- 1. Create the global sequence for all staff (Teachers + Support)
CREATE SEQUENCE IF NOT EXISTS staff_id_seq START 1001;

-- 2. Add the staff_id column to the teachers table
ALTER TABLE public.teachers 
ADD COLUMN IF NOT EXISTS staff_id text UNIQUE;

-- 3. Create a robust function to handle prefixes based on role
CREATE OR REPLACE FUNCTION generate_kibali_staff_id()
RETURNS TRIGGER AS $$
DECLARE
    role_prefix TEXT := 'T-'; -- Default to Teacher
BEGIN
    -- This logic allows you to use the same function for a future 'support_staff' table
    IF TG_TABLE_NAME = 'support_staff' THEN
        role_prefix := 'S-';
    END IF;

    -- Generate the ID: KIB + Role + Sequence (e.g., KIB-T-1001)
    IF NEW.staff_id IS NULL THEN
        NEW.staff_id := 'KIB-' || role_prefix || nextval('staff_id_seq');
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach the Trigger
DROP TRIGGER IF EXISTS tr_set_teacher_staff_id ON public.teachers;
CREATE TRIGGER tr_set_teacher_staff_id
BEFORE INSERT ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION generate_kibali_staff_id();

-- 5. Backfill existing teachers so they aren't NULL
UPDATE public.teachers 
SET staff_id = 'KIB-T-' || nextval('staff_id_seq') 
WHERE staff_id IS NULL;