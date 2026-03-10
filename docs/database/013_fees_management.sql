-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008: Fees + Engagement RLS (Fixed for Enum Transaction)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Add 'superadmin' to user_role enum ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.user_role'::regtype
      AND enumlabel  = 'superadmin'
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'superadmin';
  END IF;
END $$;

-- ── 1. Extend fee_structures ──────────────────────────────────────────────────
ALTER TABLE public.fee_structures
  ADD COLUMN IF NOT EXISTS grade           TEXT          NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS term            INTEGER       NOT NULL DEFAULT 1
    CHECK (term IN (1,2,3)),
  ADD COLUMN IF NOT EXISTS amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS academic_year   INTEGER       NOT NULL DEFAULT 2026,
  ADD COLUMN IF NOT EXISTS created_by      UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ   DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ   DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_fee_structure_grade_term_year'
  ) THEN
    ALTER TABLE public.fee_structures
      ADD CONSTRAINT uq_fee_structure_grade_term_year
      UNIQUE (grade, term, academic_year);
  END IF;
END $$;

-- ── 2. Extend fee_payments ────────────────────────────────────────────────────
ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method   TEXT          DEFAULT 'cash'
    CHECK (payment_method IN ('cash','mpesa','bank_transfer','cheque','other')),
  ADD COLUMN IF NOT EXISTS reference_number TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by      UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ   DEFAULT now();

-- ── 3. Extend announcements + school_events ──────────────────────────────────
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.school_events
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id);

-- ── 4. RLS: fee_structures ────────────────────────────────────────────────────
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_fee_structures"         ON public.fee_structures;
DROP POLICY IF EXISTS "authenticated_read_fee_structures" ON public.fee_structures;

CREATE POLICY "admin_all_fee_structures" ON public.fee_structures
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      -- Using ::text cast to bypass enum transaction commit requirement
      WHERE id = auth.uid() AND role::text IN ('admin','superadmin')
    )
  );

CREATE POLICY "authenticated_read_fee_structures" ON public.fee_structures
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── 5. RLS: fee_payments ──────────────────────────────────────────────────────
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_fee_payments"       ON public.fee_payments;
DROP POLICY IF EXISTS "parent_read_own_fee_payments" ON public.fee_payments;

CREATE POLICY "admin_all_fee_payments" ON public.fee_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin','superadmin')
    )
  );

CREATE POLICY "parent_read_own_fee_payments" ON public.fee_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.student_parents sp
      WHERE sp.student_id = fee_payments.student_id
        AND sp.parent_id  = auth.uid()
    )
  );

-- ── 6. RLS: announcements ─────────────────────────────────────────────────────
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_announcements"          ON public.announcements;
DROP POLICY IF EXISTS "authenticated_read_announcements" ON public.announcements;

CREATE POLICY "admin_all_announcements" ON public.announcements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin','superadmin')
    )
  );

CREATE POLICY "authenticated_read_announcements" ON public.announcements
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── 7. RLS: school_events ─────────────────────────────────────────────────────
ALTER TABLE public.school_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_school_events"          ON public.school_events;
DROP POLICY IF EXISTS "authenticated_read_school_events" ON public.school_events;

CREATE POLICY "admin_all_school_events" ON public.school_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role::text IN ('admin','superadmin')
    )
  );

CREATE POLICY "authenticated_read_school_events" ON public.school_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── 8. Views ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.fee_balance_summary AS
SELECT
  s.id              AS student_id,
  s.full_name       AS student_name,
  s.current_grade   AS grade,
  fp.academic_year,
  fp.term,
  COALESCE(fs.amount, 0)                           AS fee_due,
  COALESCE(fp.amount, 0)                           AS amount_paid,
  COALESCE(fs.amount, 0) - COALESCE(fp.amount, 0)  AS balance,
  fp.status,
  fp.paid_at,
  fp.payment_method
FROM public.students s
LEFT JOIN public.fee_payments   fp ON fp.student_id    = s.id
LEFT JOIN public.fee_structures fs ON fs.grade         = s.current_grade
                                  AND fs.term          = fp.term
                                  AND fs.academic_year = fp.academic_year;

CREATE OR REPLACE VIEW public.fee_grade_summary AS
SELECT
  s.current_grade AS grade,
  fp.term,
  fp.academic_year,
  COUNT(DISTINCT s.id)                                                     AS total_students,
  COUNT(DISTINCT CASE WHEN fp.status = 'paid'    THEN s.id END)            AS paid_count,
  COUNT(DISTINCT CASE WHEN fp.status = 'pending' THEN s.id END)            AS pending_count,
  COUNT(DISTINCT CASE WHEN fp.status = 'partial' THEN s.id END)            AS partial_count,
  COALESCE(SUM(CASE WHEN fp.status = 'paid'  THEN fp.amount END), 0)       AS total_collected,
  COALESCE(SUM(CASE WHEN fp.status != 'paid' THEN fp.amount END), 0)       AS total_outstanding
FROM public.students s
LEFT JOIN public.fee_payments fp ON fp.student_id = s.id
WHERE fp.academic_year IS NOT NULL
GROUP BY s.current_grade, fp.term, fp.academic_year;

-- ── 9. updated_at triggers ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at_generic()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fee_payments_updated_at   ON public.fee_payments;
CREATE TRIGGER trg_fee_payments_updated_at
  BEFORE UPDATE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();

DROP TRIGGER IF EXISTS trg_fee_structures_updated_at ON public.fee_structures;
CREATE TRIGGER trg_fee_structures_updated_at
  BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();