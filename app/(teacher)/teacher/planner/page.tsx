// app/teacher/planner/page.tsx

import { fetchLessonPlansAction } from "@/lib/actions/planner";
import { fetchTeacherAssessmentAllocations } from "@/lib/data/assessment";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStrands } from "@/lib/types/assessment";
import { getActiveTermYear } from "@/lib/utils/settings";
import { redirect } from "next/navigation";
import { PlannerClient } from "./PlannerPageClient";

export const metadata = { title: "Lesson Planner | Kibali Teacher" };
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ subject?: string; grade?: string }>;
}

export default async function PlannerPage({ searchParams }: Props) {
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
  const allocations = await fetchTeacherAssessmentAllocations(
    teacher.id,
    academicYear,
  );

  if (allocations.length === 0) {
    return (
      <PlannerClient
        teacherName={teacher.full_name}
        allocations={[]}
        initialPlans={[]}
        selectedSubject=""
        selectedGrade=""
        term={term}
        academicYear={academicYear}
        strandIds={[]}
      />
    );
  }

  const sp = await searchParams;
  const firstAlloc = allocations[0]!;
  const activeSubject = sp.subject ?? firstAlloc.subjectName;
  const activeGrade = sp.grade ?? firstAlloc.grade;

  const plans = await fetchLessonPlansAction(
    activeGrade,
    activeSubject,
    term,
    academicYear,
  );
  const strandIds = getStrands(activeGrade, activeSubject);

  return (
    <PlannerClient
      teacherName={teacher.full_name}
      allocations={allocations}
      initialPlans={plans}
      selectedSubject={activeSubject}
      selectedGrade={activeGrade}
      term={term}
      academicYear={academicYear}
      strandIds={strandIds}
    />
  );
}
