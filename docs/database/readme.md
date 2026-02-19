. System Overview
Project Name: Kibali School Management System (SMS)

Target: Primary & Junior Secondary School (JSS), Kenya.

Core Philosophy: CBC-First (Competency-Based Curriculum).

Tech Stack: Next.js 15 (App Router), Supabase (PostgreSQL + Auth + Storage), Sanity CMS (Curriculum Content).

2. The Data Architecture
   This section preserves the SQL logic we just built.

A. Unique Student ID Strategy
Format: KIB-[YEAR]-[SEQUENTIAL_ID] (e.g., KIB-2026-0001).

Implementation: Handled via a PostgreSQL sequence and a BEFORE INSERT trigger in Supabase.

Rationale: Ensures human-readable IDs for parents while maintaining database integrity without frontend collisions.

B. Schema Definition
Note: Store the SQL script provided in the previous step in a file named docs/schema.sql.

3. User Roles & Permissions (Security Matrix)
   We use Supabase Row Level Security (RLS) to enforce these:

Admin: Full CRUD (Create, Read, Update, Delete) on all tables.

Teacher: Read-only for assigned classes; Create/Update for assessments.

Parent: Read-only for students where parent_id matches their UID.

4. Integration Logic: Sanity vs. Supabase
   Sanity CMS: Stores the "Static" curriculum (Subjects, Strands, Sub-strands).

Supabase: Stores the "Dynamic" transactions (Student scores, Teacher remarks, Attendance).

The Link: The assessments table in Supabase stores the strand_id string from Sanity as a reference.
