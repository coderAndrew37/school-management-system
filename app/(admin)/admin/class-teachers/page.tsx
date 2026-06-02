import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { ClassTeacherClient } from "./ClassTeacherClient";

export const metadata = { title: "Class Teacher Assignments | Kibali Admin" };
export const revalidate = 0;

export default async function ClassTeachersPage() {
  const session = await getSession();
  
  if (!session || !session.profile) {
    redirect("/login");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect the route using the updated BaseRole structural check
  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  const supabase = await createSupabaseServerClient();

  // 1. Fetch current academic year from system_settings
  const { data: settings } = await supabase
    .from("system_settings")
    .select("current_academic_year")
    .eq("id", 1)
    .single();

  const activeYear = settings?.current_academic_year ?? 2026;

  // 2. Fetch ALL classes for this year (This provides the real UUIDs)
  const { data: classRecords } = await supabase
    .from("classes")
    .select("id, grade, stream")
    .eq("academic_year", activeYear)
    .order("grade");

  // 3. Fetch teachers for the dropdown
  const { data: teachers } = await supabase
    .from("teachers")
    .select("id, full_name, email, tsc_number")
    .order("full_name");

  // 4. Fetch active assignments with joined class data
  const { data: assignments } = await supabase
    .from("class_teacher_assignments")
    .select(
      `
      id, 
      class_id,
      academic_year,
      classes ( grade, stream ),
      teachers ( id, full_name, email )
    `,
    )
    .eq("academic_year", activeYear)
    .eq("is_active", true);

  // 5. Student counts per grade (mapping by grade string for the UI)
  const { data: studentRows } = await supabase
    .from("students")
    .select("current_grade");

  const studentCounts: Record<string, number> = {};
  studentRows?.forEach((row) => {
    studentCounts[row.current_grade] =
      (studentCounts[row.current_grade] ?? 0) + 1;
  });

  return (
    <ClassTeacherClient
      teachers={teachers ?? []}
      classes={classRecords ?? []}
      assignments={assignments ?? []}
      studentCounts={studentCounts}
      academicYear={activeYear}
    />
  );
}