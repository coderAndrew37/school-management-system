-- ============================================================
-- MIGRATION 008: Fix governance → profiles FK relationships
-- Kibali Academy CBC School Management System
-- ============================================================
-- Problem: announcements.author_id, school_events.author_id,
--   inventory_transactions.performed_by, and fee_payments.recorded_by
--   all reference auth.users(id) directly.
--   PostgREST cannot auto-join to the public.profiles table via those
--   columns, so .select("*, profiles(full_name)") throws a schema-cache error.
--
-- Fix: Drop the auth.users FK constraint and replace with a FK to
--   public.profiles(id) — which itself is 1:1 with auth.users(id).
--   This lets PostgREST resolve the join automatically.
--
-- Safe: profiles.id has ON DELETE CASCADE from auth.users, so the
--   referential integrity chain is preserved. We keep ON DELETE SET NULL
--   so deleting a profile doesn't delete the announcement.
-- ============================================================

-- ── announcements.author_id ────────────────────────────────────────────────

ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_author_id_fkey;

ALTER TABLE announcements
  ADD CONSTRAINT announcements_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ── school_events.author_id ────────────────────────────────────────────────

ALTER TABLE school_events
  DROP CONSTRAINT IF EXISTS school_events_author_id_fkey;

ALTER TABLE school_events
  ADD CONSTRAINT school_events_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ── inventory_transactions.performed_by ────────────────────────────────────

ALTER TABLE inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_performed_by_fkey;

ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_performed_by_fkey
  FOREIGN KEY (performed_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- ── fee_payments.recorded_by ───────────────────────────────────────────────

ALTER TABLE fee_payments
  DROP CONSTRAINT IF EXISTS fee_payments_recorded_by_fkey;

ALTER TABLE fee_payments
  ADD CONSTRAINT fee_payments_recorded_by_fkey
  FOREIGN KEY (recorded_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;