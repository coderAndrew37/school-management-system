// app/teacher/pathway/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
} from "@/lib/data/assessment";
import PathwayClient from "./PathwayClient";
import { redirect } from "next/navigation";

export interface JssPathwayRecord {
  id: string;
  student_id: string;
  recommended_pathway: string;
  pathway_cluster: string | null;
  strengths: string[];
  interests: string[];
  strong_subjects: string[];
  career_interests: string[];
  learning_style: string | null;
  teacher_notes: string | null;
  updated_at: string;
}

export default async function PathwayPage() {
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

  // JSS = Grades 7, 8, 9 only
  const jssGrades = [...new Set(allocations.map((a) => a.grade))]
    .filter((g) => ["Grade 7", "Grade 8", "Grade 9"].includes(g))
    .sort();

  const studentsByGrade: Record<
    string,
    Awaited<ReturnType<typeof fetchClassStudents>>
  > = {};
  await Promise.all(
    jssGrades.map(async (grade) => {
      studentsByGrade[grade] = await fetchClassStudents(grade);
    }),
  );

  const allStudentIds = Object.values(studentsByGrade)
    .flat()
    .map((s) => s.id);

  // Fetch existing pathways
  let existingPathways: JssPathwayRecord[] = [];
  if (allStudentIds.length > 0) {
    const { data } = await supabase
      .from("jss_pathways")
      .select("*")
      .in("student_id", allStudentIds)
      .order("updated_at", { ascending: false });
    existingPathways = (data ?? []) as JssPathwayRecord[];
  }

  return (
    <PathwayClient
      teacherName={teacher.full_name}
      jssGrades={jssGrades}
      studentsByGrade={studentsByGrade}
      existingPathways={existingPathways}
    />
  );
}
