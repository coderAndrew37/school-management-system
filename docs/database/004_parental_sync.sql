CREATE OR REPLACE FUNCTION current_parent_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- We now ensure parent.id matches auth.uid()
  SELECT id FROM parents WHERE id = auth.uid();
$$;