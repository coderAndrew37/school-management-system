// app/teacher/diary/page.tsx
// Server component — auth, data fetching only. No UI logic.

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
} from "@/lib/data/assessment";
import { fetchTeacherDiaryEntries, fetchClassOptions } from "@/lib/data/diary";
import { getActiveTermYear } from "@/lib/utils/settings";
import DiaryClient from "./DiaryClient";

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
    .single<{ id: string; full_name: string }>();
  if (!teacher) redirect("/login");

  const { academicYear } = await getActiveTermYear();

  // Grades from subject allocations
  const allocations = await fetchTeacherAssessmentAllocations(
    teacher.id,
    academicYear,
  );
  const uniqueGrades = [...new Set(allocations.map((a) => a.grade))].sort();

  // Class options for grade display (stream-aware labels)
  const classOptions = await fetchClassOptions(academicYear);

  // Students per grade for the observation picker
  const studentsByGrade: Record<
    string,
    Awaited<ReturnType<typeof fetchClassStudents>>
  > = {};
  await Promise.all(
    uniqueGrades.map(async (grade) => {
      studentsByGrade[grade] = await fetchClassStudents(grade);
    }),
  );

  const initialEntries = await fetchTeacherDiaryEntries(uniqueGrades, 60);

  return (
    <DiaryClient
      teacherName={teacher.full_name}
      grades={uniqueGrades}
      classOptions={classOptions}
      studentsByGrade={studentsByGrade}
      initialEntries={initialEntries}
    />
  );
}
