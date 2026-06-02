// app/teacher/layout.tsx

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import { TeacherLayoutShell } from "../_components/nav/TeacherLayoutShell";

interface AssignmentClass {
  id: string;
  grade: string;
  stream: string | null;
}

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || !session.profile) {
    redirect("/login?redirectTo=/teacher");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Modernized structural base_role check mapping "staff" for all school teachers
  if (base_role !== "staff" && base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  const assignment = await fetchMyClassTeacherAssignments();

  const isClassTeacher = assignment?.isClassTeacher ?? false;

  // Extract the 'grade' strings safely avoiding any implicit type mismatches
  const teacherClasses = (assignment?.classes as unknown as AssignmentClass[]) || [];
  const classGrades = teacherClasses.map((c) => c.grade);

  return (
    <TeacherLayoutShell
      profile={session.profile}
      email={session.user.email ?? ""}
      isClassTeacher={isClassTeacher}
      classGrades={classGrades}
    >
      {children}
    </TeacherLayoutShell>
  );
}