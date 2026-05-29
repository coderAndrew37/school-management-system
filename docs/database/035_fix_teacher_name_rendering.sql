-- ============================================================
-- FIX 1: Add same-school profile read policy
-- Allows PostgREST back-reference joins (teachers → profiles)
-- to resolve full_name, email etc. for peer staff rows.
-- Scoped strictly to school_id from JWT — no cross-tenant risk.
-- JWT carries school_id via sync_user_jwt_claims.
-- ============================================================
DROP POLICY IF EXISTS "profiles_same_school_read" ON public.profiles;

CREATE POLICY "profiles_same_school_read"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
  );


-- ============================================================
-- FIX 2: Rewrite teachers policies to use JWT instead of a
-- profiles subquery. Eliminates the recursive RLS evaluation
-- and makes teacher reads faster.
-- ============================================================
DROP POLICY IF EXISTS "teachers_read_own_school"   ON public.teachers;
DROP POLICY IF EXISTS "teachers_write_super_admin" ON public.teachers;

CREATE POLICY "teachers_read_own_school"
  ON public.teachers FOR SELECT
  TO authenticated
  USING (
    school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
  );

CREATE POLICY "teachers_write_super_admin"
  ON public.teachers FOR ALL
  TO authenticated
  USING (
    school_id = (auth.jwt() -> 'app_metadata' ->> 'school_id')::uuid
    AND (auth.jwt() -> 'app_metadata' ->> 'is_super_admin')::boolean = true
  );