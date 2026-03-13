-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009 — school_settings
-- Single-row configuration table for school identity, academic calendar,
-- and notification toggles. Run once in Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_settings (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  school_name                 text        NOT NULL DEFAULT 'Kibali Academy',
  school_motto                text,
  school_address              text,
  school_phone                text,
  school_email                text,
  logo_url                    text,       -- Supabase Storage path (not full URL)

  -- Academic calendar
  current_term                int         NOT NULL DEFAULT 1
                                          CHECK (current_term IN (1, 2, 3)),
  current_academic_year       int         NOT NULL DEFAULT 2026,

  term1_start                 date,
  term1_end                   date,
  term2_start                 date,
  term2_end                   date,
  term3_start                 date,
  term3_end                   date,

  -- Notification toggles
  sms_notifications_enabled   boolean     NOT NULL DEFAULT true,
  email_notifications_enabled boolean     NOT NULL DEFAULT true,

  -- Audit
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  updated_by                  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. Enforce single-row constraint ────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS school_settings_singleton
  ON public.school_settings ((true));

-- 3. Seed one row (idempotent) ─────────────────────────────────────────────────
INSERT INTO public.school_settings (
  school_name,
  school_motto,
  school_address,
  school_phone,
  school_email,
  current_term,
  current_academic_year,
  term1_start, term1_end,
  term2_start, term2_end,
  term3_start, term3_end,
  sms_notifications_enabled,
  email_notifications_enabled
)
VALUES (
  'Kibali Academy',
  'Preserving Excellence',
  'Lang''ata Road, Karen South, Nairobi',
  '+254 712 345 678',
  'info@kibali.ac.ke',
  1,
  2026,
  '2026-01-06', '2026-03-27',
  '2026-05-05', '2026-07-24',
  '2026-09-07', '2026-11-27',
  true,
  true
)
ON CONFLICT ((true)) DO NOTHING;

-- 4. Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_school_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_settings_updated_at ON public.school_settings;
CREATE TRIGGER trg_school_settings_updated_at
  BEFORE UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_school_settings_updated_at();

-- 5. RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read settings (needed for parent/teacher pages)
CREATE POLICY "Authenticated users can read school settings"
  ON public.school_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admin/superadmin can update
CREATE POLICY "Admins can update school settings"
  ON public.school_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'superadmin')
    )
  );

-- 6. Storage bucket for school logo (run if not already created) ──────────────
-- In Supabase dashboard: Storage → New bucket → name: "school-assets"
-- Or run:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('school-assets', 'school-assets', true)
-- ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read logo
-- CREATE POLICY "Public read school assets"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'school-assets');

-- Allow admins to upload logo
-- CREATE POLICY "Admins can upload school assets"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     bucket_id = 'school-assets'
--     AND EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND role IN ('admin','superadmin')
--     )
--   );