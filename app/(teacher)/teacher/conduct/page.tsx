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
import { type ClassInfo } from "./_components/ConductForm";

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
    .single();

  if (!teacher) redirect("/login");

  const { term, academicYear } = await getActiveTermYear();

  const [assignment, allocations] = await Promise.all([
    fetchMyClassTeacherAssignments(),
    fetchTeacherAssessmentAllocations(teacher.id, academicYear),
  ]);

  // Use the exported ClassInfo type to ensure consistency with the form
  const classesMap = new Map<string, ClassInfo>();

  /**
   * Handle assignments from fetchMyClassTeacherAssignments
   * Explicitly storing grade and stream for the new DB schema
   */
  assignment?.classes?.forEach((c: any) => {
    if (c.id) {
      classesMap.set(c.id, {
        id: c.id,
        grade: c.grade,
        stream: c.stream || "Main",
      });
    }
  });

  /**
   * Handle allocations using the TeacherAllocationSummary interface
   * This ensures subject teachers also see their specific classes
   */
  allocations.forEach((a) => {
    classesMap.set(a.classId, {
      id: a.classId,
      grade: a.grade,
      stream: a.stream || "Main",
    });
  });

  const classes = Array.from(classesMap.values());

  // Early return with empty state if no classes are found
  if (classes.length === 0) {
    return (
      <ConductClient
        teacherName={teacher.full_name}
        classes={[]}
        studentsByClass={{}}
        initialRecords={[]}
        term={term}
        academicYear={academicYear}
      />
    );
  }

  const studentsByClass: Record<
    string,
    Awaited<ReturnType<typeof fetchClassStudents>>
  > = {};

  const classIds = classes.map((c) => c.id);

  // Parallel fetching of students for all assigned classes
  await Promise.all(
    classIds.map(async (id) => {
      studentsByClass[id] = await fetchClassStudents(id);
    }),
  );

  const records = await fetchConductRecordsAction(classIds, academicYear, term);

  return (
    <ConductClient
      teacherName={teacher.full_name}
      classes={classes}
      studentsByClass={studentsByClass}
      initialRecords={records}
      term={term}
      academicYear={academicYear}
    />
  );
}
