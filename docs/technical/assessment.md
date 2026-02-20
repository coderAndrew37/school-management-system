supabase/migrations/
005_batch_assessment.sql ← DB changes

lib/types/
assessment.ts ← CBC strand defs + grid types

lib/data/
assessment.ts ← server-side data fetching

lib/actions/
assessment.ts ← server actions (save, generate)

components/assessment/
BatchAssessmentGrid.tsx ← the Excel-like spreadsheet

app/teacher/
page.tsx ← updated (Assess Students button)
assess/
page.tsx ← subject picker + grid host
