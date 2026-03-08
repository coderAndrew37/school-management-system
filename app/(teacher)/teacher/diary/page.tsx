// app/teacher/diary/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
  fetchTeacherDiaryEntries,
} from "@/lib/data/assessment";
import DiaryClient from "./DiaryClient";
import { redirect } from "next/navigation";

export default async function DiaryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, full_name")
    .eq("id", user.id)
    .single();

  if (!teacher) redirect("/login");

  const allocations = await fetchTeacherAssessmentAllocations(teacher.id, 2026);
  const uniqueGrades = [...new Set(allocations.map((a) => a.grade))].sort();

  // All students across teacher's grades (for the student picker)
  const studentsByGrade: Record<
    string,
    Awaited<ReturnType<typeof fetchClassStudents>>
  > = {};
  await Promise.all(
    uniqueGrades.map(async (grade) => {
      studentsByGrade[grade] = await fetchClassStudents(grade);
    }),
  );

  const recentEntries = await fetchTeacherDiaryEntries(uniqueGrades, 30);

  return (
    <DiaryClient
      teacherName={teacher.full_name}
      grades={uniqueGrades}
      studentsByGrade={studentsByGrade}
      initialEntries={recentEntries}
    />
  );
}
