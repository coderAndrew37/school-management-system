1. Student Profile & Digital ID
   Parents can view the official details of their children as registered in the system.

CBC Identification: Display of the system-generated readable_id (KIB-2026-XXXX) and the Government NEMIS UPI.

Bio Data: Verification of Date of Birth, Gender, and current Grade/Class.

Linking: A single parent login can toggle between multiple children if they have more than one student enrolled at Kibali.

2. CBC Assessment Tracking
   This is the core value proposition. Instead of waiting for a physical report card, parents see progress in real-time.

   also we can have competency radar charts

Performance Levels: Visual indicators of the standard CBC scores:

EE (Exceeding Expectation)

ME (Meeting Expectation)

AE (Approaching Expectation)

BE (Below Expectation)

Evidence of Learning: If a teacher uploads a photo of a project to Supabase Storage, the parent can see the evidence_url directly.

Strand Breakdown: Seeing exactly how the child is performing in specific areas (e.g., "Human Anatomy" vs "Performing Arts").

3. Financial & Administrative (Roadmap)
   Using the phone_number in your parents table, the portal serves as a gateway for:

(Fee Statements: Viewing balances and payment history.

M-Pesa Integration: Using the phone number to trigger STK pushes for school fees or activity levies. this will be implemented later, we dont implement it now)

Teacher Communication: Viewing remarks left by teachers during assessments to understand where the child needs support at home.

4. Schedule & Attendance
   Timetable Access: Viewing the timetable_slots so they know which subjects are being taught on which days.

Attendance Alerts: (we will implement it later when we switch to pwa) notifications if a child is absent from school.

Technical Guardrails for Parents
Because parents are external users, the security needs to be even tighter than the teacher side:

Scoped Access: The current_parent_id() function you wrote in Migration 003 is critical.

It ensures a parent can only see students where students.parent_id matches their own ID.

Mobile-First Design: Unlike the Admin dashboard (which is usually used on a PC), parents will primarily access this via their phones. The UI needs to be responsive and lightweight.

Read-Only Permission: Your RLS policies correctly ensure parents have SELECT access but no INSERT or UPDATE access to assessments or student records.

Implementation Status Check
To get the Parent side fully operational, you will eventually need:

A "My Children" Page: A grid showing cards for each child linked to that parent.

A "Progress Report" View: A detailed list of all assessments for a specific student.

Profile Update: Allowing parents to update their own email or avatar_url without touching the student's academic data.
