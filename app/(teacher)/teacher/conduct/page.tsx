// app/teacher/conduct/page.tsx

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
} from "@/lib/data/assessment";
import { fetchConductRecordsAction } from "@/lib/actions/conduct";
import { getActiveTermYear } from "@/lib/utils/settings";
import { ConductClient } from "./ConductClient";

export const metadata = { title: "Conduct & Merits | Kibali Teacher" };
export const revalidate = 0;

export default async function ConductPage() {
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

  const { term, academicYear } = await getActiveTermYear();

  // Collect grades from class teacher assignment + subject allocations
  const [assignment, allocations] = await Promise.all([
    fetchMyClassTeacherAssignments(),
    fetchTeacherAssessmentAllocations(teacher.id, academicYear),
  ]);

  const classGrades = assignment?.grades ?? [];
  const allocationGrades = [...new Set(allocations.map((a) => a.grade))].sort();
  const grades = [
    ...classGrades,
    ...allocationGrades.filter((g) => !classGrades.includes(g)),
  ];

  if (grades.length === 0) {
    return (
      <ConductClient
        teacherName={teacher.full_name}
        grades={[]}
        studentsByGrade={{}}
        initialRecords={[]}
        term={term}
        academicYear={academicYear}
      />
    );
  }

  // Pre-load students and conduct records in parallel
  const studentsByGrade: Record<
    string,
    Awaited<ReturnType<typeof fetchClassStudents>>
  > = {};
  const [, records] = await Promise.all([
    Promise.all(
      grades.map(async (g) => {
        studentsByGrade[g] = await fetchClassStudents(g);
      }),
    ),
    fetchConductRecordsAction(grades, academicYear, term),
  ]);

  return (
    <ConductClient
      teacherName={teacher.full_name}
      grades={grades}
      studentsByGrade={studentsByGrade}
      initialRecords={records}
      term={term}
      academicYear={academicYear}
    />
  );
}
