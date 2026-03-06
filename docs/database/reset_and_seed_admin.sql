-- ============================================================
-- RESET & ADMIN SEED SCRIPT
-- Kibali Academy CBC School Management System
--
-- PURPOSE:
--   1. Wipe all app data AND auth.users so emails can be reused.
--   2. Instructions to create the first admin user.
--
-- HOW TO RUN:
--   Paste into the Supabase SQL editor and click Run.
--   DESTRUCTIVE — do not run in production.
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: WIPE ALL APP DATA
-- Leaf tables first, then their parents.
-- communications_log MUST come first — it references profiles.id
-- via communications_log_sent_by_fkey.
-- ============================================================

-- References profiles (must be first)
DELETE FROM communications_log;

-- Messaging
DELETE FROM communication_book;

-- Notifications
DELETE FROM notifications;

-- Student-related leaf tables
DELETE FROM jss_pathways;
DELETE FROM talent_gallery;
DELETE FROM student_diary;
DELETE FROM attendance;
DELETE FROM assessment_narratives;
DELETE FROM assessments;

-- Inventory
DELETE FROM inventory_transactions;
DELETE FROM inventory_items;

-- Fees
DELETE FROM fee_payments;
DELETE FROM fee_structures;

-- Governance / calendar
DELETE FROM announcements;
DELETE FROM school_events;

-- Timetable
DELETE FROM timetable_slots;
DELETE FROM teacher_subject_allocations;

-- Student ↔ Parent join table (migration 004)
DELETE FROM student_parents;

-- Core entities
DELETE FROM students;
DELETE FROM parents;
DELETE FROM teachers;

-- ============================================================
-- PART 2: WIPE AUTH — removes profiles via CASCADE
-- profiles.id has ON DELETE CASCADE to auth.users, so deleting
-- auth.users automatically removes the profiles rows.
-- Emails become reusable immediately after this.
-- ============================================================

DELETE FROM auth.users;

-- Belt-and-suspenders: if cascade didn't fire for any reason
DELETE FROM profiles;

-- ============================================================
-- PART 3: VERIFY — all counts should be 0
-- ============================================================

SELECT 'auth.users'          AS tbl, COUNT(*) AS rows FROM auth.users
UNION ALL SELECT 'profiles',               COUNT(*) FROM profiles
UNION ALL SELECT 'parents',                COUNT(*) FROM parents
UNION ALL SELECT 'students',               COUNT(*) FROM students
UNION ALL SELECT 'teachers',               COUNT(*) FROM teachers
UNION ALL SELECT 'student_parents',        COUNT(*) FROM student_parents
UNION ALL SELECT 'communications_log',     COUNT(*) FROM communications_log
UNION ALL SELECT 'communication_book',     COUNT(*) FROM communication_book;

COMMIT;

-- ============================================================
-- PART 4: CREATE FIRST ADMIN USER
--
-- Supabase blocks direct INSERT into auth.users from SQL editor.
--
-- STEP A — In the Supabase dashboard:
--   Authentication → Users → "Add user"
--   Enter the admin email + a temporary password → Create user
--   Copy the UUID Supabase assigns.
--
-- STEP B — Paste the UUID below and run just this block:
-- ============================================================

-- UPDATE profiles
-- SET
--   role      = 'admin',
--   full_name = 'School Administrator'
-- WHERE id = '<paste-admin-uuid-here>';

-- Or use the helper from migration 003:
-- SELECT promote_to_admin('<paste-admin-uuid-here>');

-- ============================================================
-- PART 5: VERIFY ADMIN
-- ============================================================

-- SELECT id, full_name, role, created_at
-- FROM profiles
-- WHERE role = 'admin';