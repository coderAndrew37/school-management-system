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

  // 1. Get allocations to find exactly which classes (UUIDs) this teacher handles
  const allocations = await fetchTeacherAssessmentAllocations(
    teacher.id,
    academicYear,
  );
  
  // Extract unique class IDs (UUIDs) the teacher is assigned to
  const teacherClassIds = [...new Set(allocations.map((a) => a.classId))].filter(Boolean) as string[];

  // 2. Fetch Class Options (The labels/metadata for those UUIDs)
  const allClassOptions = await fetchClassOptions(academicYear);
  
  // Filter options to only show classes this teacher actually teaches
  const teacherClassOptions = allClassOptions.filter(opt => 
    teacherClassIds.includes(opt.id)
  );

  // 3. Fetch students grouped by Class UUID for the observation picker
  const studentsByClass: Record<
    string,
    Awaited<ReturnType<typeof fetchClassStudents>>
  > = {};

  await Promise.all(
    teacherClassIds.map(async (classId) => {
      studentsByClass[classId] = await fetchClassStudents(classId);
    }),
  );

  // 4. Fetch the existing diary entries using the UUID array
  const initialEntries = await fetchTeacherDiaryEntries(teacherClassIds, 60);

  return (
    <DiaryClient
      teacherName={teacher.full_name}
      classOptions={teacherClassOptions}
      studentsByClass={studentsByClass}
      initialEntries={initialEntries}
    />
  );
}