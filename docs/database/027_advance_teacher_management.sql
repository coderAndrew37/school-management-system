-- 1. Remove the restrictive old constraint
ALTER TABLE public.teachers 
DROP CONSTRAINT IF EXISTS teachers_status_check;

-- 2. Add the comprehensive status list
ALTER TABLE public.teachers 
ADD CONSTRAINT teachers_status_check 
CHECK (status = ANY (ARRAY[
  'active',      -- Currently teaching
  'on_leave',    -- Sick/Maternity/Study leave (temporary)
  'transferred', -- Moved to another school (archived)
  'terminated',  -- Sacked (archived)
  'resigned',    -- Left voluntarily (archived)
  'deceased',    -- Death (archived)
  'retired'      -- Completed service (archived)
]::text[]));

-- 3. Add an archived_at timestamp for better reporting
ALTER TABLE public.teachers 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;