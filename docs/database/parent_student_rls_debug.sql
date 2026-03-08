-- ============================================================
-- DEBUG QUERIES — Run these in Supabase SQL Editor
-- Replace '<parent-email>' with the actual parent's email
-- Replace '<parent-uuid>' with the actual parent's auth.users UUID
-- ============================================================

-- STEP 1: Confirm the parent exists in auth.users
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
WHERE email = '<parent-email>';

-- STEP 2: Confirm the parents table row exists and id matches auth.users.id
SELECT id, full_name, email, invite_accepted
FROM parents
WHERE email = '<parent-email>';

-- STEP 3: Confirm student_parents has a row linking this parent
SELECT sp.*, s.full_name AS student_name, s.current_grade
FROM student_parents sp
JOIN students s ON s.id = sp.student_id
WHERE sp.parent_id = '<parent-uuid>';

-- STEP 4: Test current_parent_id() as that user
-- Run this to see what the function returns for a given auth uid
SELECT current_parent_id() AS resolved_parent_id;
-- NOTE: This runs as the SERVICE ROLE so it returns NULL (no auth.uid() in SQL editor).
-- Use the impersonation query below instead:

-- STEP 5: Impersonate the parent and test RLS directly
-- This is the most accurate test — simulates exactly what the app does
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<parent-uuid>", "role": "authenticated"}';

SELECT current_parent_id();   -- Should return '<parent-uuid>'

SELECT * FROM students;       -- Should return this parent's children only

SELECT * FROM student_parents WHERE parent_id = current_parent_id();

RESET role;

-- STEP 6: Check profiles table — role must be 'parent'
SELECT id, role, full_name
FROM profiles
WHERE id = '<parent-uuid>';

-- STEP 7: Check if auth.users.id = parents.id (they MUST match)
SELECT
  u.id   AS auth_id,
  p.id   AS parent_id,
  u.email,
  u.id = p.id AS ids_match
FROM auth.users u
JOIN parents p ON p.email = u.email
WHERE u.email = '<parent-email>';

-- STEP 8: Full join — see the entire chain
SELECT
  u.id        AS auth_uid,
  p.id        AS parent_id,
  p.full_name AS parent_name,
  u.id = p.id AS ids_match,
  sp.student_id,
  s.full_name AS student_name,
  s.current_grade
FROM auth.users u
LEFT JOIN parents        p  ON p.email = u.email
LEFT JOIN student_parents sp ON sp.parent_id = p.id
LEFT JOIN students        s  ON s.id = sp.student_id
WHERE u.email = '<parent-email>';