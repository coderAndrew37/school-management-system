import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
} from "@/lib/data/assessment";
import AttendanceClient from "./AttendanceClient";
import { redirect } from "next/navigation";

export default async function AttendancePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get teacher profile
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, full_name")
    .eq("id", user.id)
    .single();

  if (!teacher) redirect("/login");

  // Get allocations to know which grades this teacher handles
  const allocations = await fetchTeacherAssessmentAllocations(teacher.id, 2026);
  const uniqueGrades = [...new Set(allocations.map((a) => a.grade))].sort();

  // Pre-load students for each grade
  const studentsByGrade: Record<
    string,
    Awaited<ReturnType<typeof fetchClassStudents>>
  > = {};
  await Promise.all(
    uniqueGrades.map(async (grade) => {
      studentsByGrade[grade] = await fetchClassStudents(grade);
    }),
  );

  return (
    <AttendanceClient
      teacherName={teacher.full_name}
      grades={uniqueGrades}
      studentsByGrade={studentsByGrade}
    />
  );
}
