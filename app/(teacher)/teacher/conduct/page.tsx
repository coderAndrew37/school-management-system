import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
  type ClassStudent,
} from "@/lib/data/assessment";
import { fetchConductRecordsAction } from "@/lib/actions/conduct";
import { getActiveTermYear } from "@/lib/utils/settings";
import { ConductClient } from "./ConductClient";
import { type ClassInfo } from "./_components/ConductForm";

export const metadata = { title: "Conduct & Merits | Kibali Teacher" };

// Ensure we always have the freshest conduct data on load
export const revalidate = 0;

// Internal interface to resolve the missing 'id' type from assignments
interface AssignmentClass {
  id: string;
  grade: string;
  stream: string | null;
}

export default async function ConductPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");

  // Fetch teacher profile
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, full_name")
    .eq("id", user.id)
    .single();

  if (!teacher) redirect("/login");

  const { term, academicYear } = await getActiveTermYear();

  // 1. Fetch all possible class sources in parallel
  const [assignment, allocations] = await Promise.all([
    fetchMyClassTeacherAssignments(),
    fetchTeacherAssessmentAllocations(teacher.id, academicYear),
  ]);

  // 2. Aggregate unique classes using a Map to prevent duplicates
  const classesMap = new Map<string, ClassInfo>();

  /**
   * Safely handle assignments. 
   * Casting the array type here is the safe alternative to 'any' 
   * when the external lib type is too narrow.
   */
  const teacherClasses = (assignment?.classes as unknown as AssignmentClass[]) || [];

  teacherClasses.forEach((c) => {
    if (c.id) {
      classesMap.set(c.id, {
        id: c.id,
        grade: c.grade,
        stream: c.stream || "Main",
      });
    }
  });

  // From Subject Teacher allocations
  allocations.forEach((a) => {
    classesMap.set(a.classId, {
      id: a.classId,
      grade: a.grade,
      stream: a.stream || "Main",
    });
  });

  const classes = Array.from(classesMap.values());

  // Early return if teacher has no classes assigned
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

  const classIds = classes.map((c) => c.id);

  // 3. Fetch students and conduct records in parallel
  const studentsByClass: Record<string, ClassStudent[]> = {};

  const [records] = await Promise.all([
    fetchConductRecordsAction(classIds, academicYear, term),
    ...classIds.map(async (id) => {
      const classStudents = await fetchClassStudents(id);
      studentsByClass[id] = classStudents;
    }),
  ]);

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