# CBC Diary Refactor — Integration Guide

## File map

| This file                  | Drop into your project at                                                |
| -------------------------- | ------------------------------------------------------------------------ |
| `migration.sql`            | Run in Supabase SQL editor                                               |
| `assessment-types.ts`      | Merge into `lib/data/assessment.ts` — replace the diary types + fetchers |
| `teacher-diary-actions.ts` | Create as `lib/actions/teacher-diary.ts`                                 |
| `DiaryClient.tsx`          | Replace `app/teacher/diary/DiaryClient.tsx`                              |
| `diary-page.tsx`           | Replace `app/teacher/diary/page.tsx`                                     |
| `parent-diary-fetcher.ts`  | Merge into `lib/data/parent.ts`                                          |

---

## Deployment order

### 1. Run the migration FIRST (non-destructive)

```sql
-- In Supabase SQL editor
-- Adds: entry_type column, grade column, index, integrity constraint
-- Backfills: grade from students table for existing rows
-- Does NOT: drop any column, change any existing data values
```

Verify:

```sql
SELECT entry_type, grade, count(*) FROM student_diary GROUP BY 1, 2;
```

All existing rows should show `entry_type = 'homework'` and a populated `grade`.

### 2. Deploy the server actions

`teacher-diary-actions.ts` exports three create functions:

- `createClassDiaryEntryAction` — for homework + notice (student_id = null)
- `createObservationAction` — for observation (student_id required)
- `updateDiaryEntryAction` — for editing any type
- `toggleHomeworkCompleteAction` — teacher marks class submitted
- `deleteDiaryEntryAction` — remove any entry

Remove or deprecate the old `createDiaryEntryAction` from `teacher.ts` once deployed.

### 3. Deploy the updated data fetcher

The new `fetchTeacherDiaryEntries` runs two parallel queries instead of the old
student-join approach. It returns a unified `TeacherDiaryEntry[]` typed union.

### 4. Deploy DiaryClient + page

The new form has three modes selectable via a tab strip:

- **Homework** — class-wide, has due date, completable
- **Notice** — class-wide, no due date, read-only
- **Observation** — student-scoped, private to parent

Teachers can no longer accidentally post a personal note as a class-wide broadcast.

### 5. Update the parent portal

Use `fetchParentDiaryBuckets` to split the feed into three sections:

- Homework checklist (with due dates + submitted badge)
- Announcements (notices)
- Learning portrait (observations, most personal)

---

## The integrity constraint explained

```sql
CHECK (
  (entry_type = 'observation' AND student_id IS NOT NULL)
  OR
  (entry_type IN ('homework', 'notice') AND student_id IS NULL)
)
```

This makes it **impossible at the database level** to:

- Save an observation without a student_id (it would be invisible)
- Save homework/notice with a student_id (it would only show to one parent)

The application enforces this too, but the DB constraint is the safety net.

---

## What did NOT change

- `MessagesClient` and `MessagesPage` — untouched
- `sendParentNotificationAction` — untouched
- `notifications` table — untouched
- All assessment / attendance / pathway actions — untouched
- The `homework boolean` column is kept for backwards compatibility and
  synced on insert (`homework = entry_type === 'homework'`)

---

## Entry type decision guide (for teacher onboarding docs)

| Situation                                                  | Use                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| "Page 45 Spark Workbook due Friday"                        | **Homework**                                                 |
| "Swimming gala — bring kit tomorrow"                       | **Notice**                                                   |
| "No school on Thursday (public holiday)"                   | **Notice**                                                   |
| "Amara led the science lab with confidence"                | **Observation**                                              |
| "Brian is struggling with reading — needs support at home" | **Observation**                                              |
| "Andrew won the inter-school debate"                       | **Observation** (personal) or **Notice** (class achievement) |
| "Tomorrow: parents bring KES 500 for excursion"            | **Notice**                                                   |

The rule: if it's about **one child**, it's an Observation.
If it's about **the whole class or school**, it's a Homework or Notice.
If the parent needs to **take action**, it's a Homework. Otherwise it's a Notice.
