// app/teacher/diary/page.tsx
// Server component — auth, data fetching only. No UI logic.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
} from "@/lib/data/assessment";
import { fetchTeacherDiaryEntries, fetchClassOptions } from "@/lib/data/diary";
import { getActiveTermYear } from "@/lib/utils/settings";
import DiaryClient from "./DiaryClient";

export const metadata = { title: "Teacher Diary | Kibali Teacher" };
export const revalidate = 0;

export default async function DiaryPage() {
  // ── Access Control Guard ───────────────────────────────────────────────────
  const session = await getSession();
  if (!session || !session.profile) {
    redirect("/login");
  }

  const { base_role, is_super_admin, is_dev, full_name, id: teacherId } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect route with structural check for staff (teachers) and administration overrides
  if (base_role !== "staff" && base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  const { academicYear } = await getActiveTermYear();

  // 1. Get allocations to find exactly which classes (UUIDs) this teacher handles
  const allocations = await fetchTeacherAssessmentAllocations(
    teacherId,
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
      teacherName={full_name ?? ""}
      classOptions={teacherClassOptions}
      studentsByClass={studentsByClass}
      initialEntries={initialEntries}
    />
  );
}