CREATE OR REPLACE FUNCTION current_parent_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- We now ensure parent.id matches auth.uid()
  SELECT id FROM parents WHERE id = auth.uid();
$$;

--add resend invite email
-- Track if the parent has completed the onboarding flow
ALTER TABLE parents ADD COLUMN IF NOT EXISTS invite_accepted BOOLEAN DEFAULT FALSE;

-- Track when the last invite was sent to prevent accidental spamming
ALTER TABLE parents ADD COLUMN IF NOT EXISTS last_invite_sent TIMESTAMP WITH TIME ZONE;