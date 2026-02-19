scripts/
generate_reports.py ← ReportLab PDF engine (tested & working)

app/
reports/page.tsx ← Route: /reports (Server Component)
api/reports/generate/route.ts ← POST /api/reports/generate (streams PDF)

components/reports/
ReportsClient.tsx ← "use client" — filter UI + download trigger

lib/
types/reports.ts ← ReportStudent, ReportAssessment, etc.
data/reports.ts ← Supabase fetch for students + joined assessments

supabase/migrations/
001_base_schema.sql ← Updated with KAL- prefix trigger
