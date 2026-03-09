// app/teacher/class/attendance/page.tsx
// Class teacher bulk attendance roster — marks the whole class in one page.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchClassStudents } from "@/lib/data/assessment";
import { redirect } from "next/navigation";
import { ClassAttendanceClient } from "./ClassAttendanceClient";

export const metadata = { title: "Class Register | Kibali Teacher Portal" };
export const revalidate = 0;

export default async function ClassAttendancePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify teacher profile
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, full_name")
    .eq("id", user.id)
    .single();

  if (!teacher) redirect("/login");

  // Check class teacher assignment
  const { data: assignment } = await supabase
    .from("class_teacher_assignments")
    .select("id, grade, academic_year")
    .eq("teacher_id", user.id)
    .eq("academic_year", 2026)
    .maybeSingle();

  if (!assignment) {
    // Not a class teacher — redirect to subject attendance page
    redirect("/teacher/attendance");
  }

  const students = await fetchClassStudents(assignment.grade);

  // Fetch today's attendance so the roster pre-fills if already marked
  const today = new Date().toISOString().split("T")[0]!;
  const studentIds = students.map((s) => s.id);

  const { data: todayAttendance } =
    studentIds.length > 0
      ? await supabase
          .from("attendance")
          .select("student_id, status, remarks")
          .in("student_id", studentIds)
          .eq("date", today)
      : { data: [] };

  // Build pre-fill map: studentId → { status, remarks }
  const preFill: Record<string, { status: string; remarks: string }> = {};
  for (const r of (todayAttendance ?? []) as {
    student_id: string;
    status: string;
    remarks: string | null;
  }[]) {
    preFill[r.student_id] = { status: r.status, remarks: r.remarks ?? "" };
  }

  return (
    <ClassAttendanceClient
      teacherName={teacher.full_name}
      grade={assignment.grade}
      students={students}
      todayDate={today}
      preFill={preFill}
    />
  );
}
