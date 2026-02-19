supabase/migrations/
002_subject_allocation_timetable.sql ← Run this first in Supabase SQL editor

lib/
types/allocation.ts ← All interfaces + CBC constants (grades, days, periods)
data/allocation.ts ← Server-side Supabase fetch functions
actions/allocation.ts ← 3 Server Actions (create, delete, generate)

components/
allocation/
AllocationPanel.tsx ← "use client" — teacher picker + subject assign UI
GenerateTimetableButton.tsx ← "use client" — confirm + trigger generation

timetable/
TimetableView.tsx ← "use client" — interactive grade tab + weekly grid

app/
allocation/page.tsx ← Route: /allocation (Server Component)
timetable/page.tsx ← Route: /timetable (Server Component)
