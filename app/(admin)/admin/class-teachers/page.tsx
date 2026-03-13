// app/admin/class-teachers/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { ClassTeacherClient } from "./ClassTeacherClient";

export const metadata = { title: "Class Teacher Assignments | Kibali Admin" };
export const revalidate = 0;

export default async function ClassTeachersPage() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // All teachers (for the assignment dropdowns)
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, full_name, email, tsc_number")
    .order("full_name");

  // All distinct grades that have students
  const { data: gradeRows } = await supabase
    .from("students")
    .select("current_grade")
    .order("current_grade");

  const allGrades = [
    ...new Set(
      (gradeRows ?? []).map((r: { current_grade: string }) => r.current_grade),
    ),
  ].sort();

  // Current assignments for 2026
  const { data: assignments } = await supabase
    .from("class_teacher_assignments")
    .select(
      `
      id, grade, academic_year, created_at,
      teachers ( id, full_name, email )
    `,
    )
    .eq("academic_year", 2026)
    .order("grade");

  // Student counts per grade
  const { data: studentRows } = await supabase
    .from("students")
    .select("current_grade");

  const studentCounts: Record<string, number> = {};
  for (const row of (studentRows ?? []) as { current_grade: string }[]) {
    studentCounts[row.current_grade] =
      (studentCounts[row.current_grade] ?? 0) + 1;
  }

  return (
    <ClassTeacherClient
      teachers={teachers ?? []}
      grades={allGrades}
      assignments={assignments ?? []}
      studentCounts={studentCounts}
    />
  );
}
