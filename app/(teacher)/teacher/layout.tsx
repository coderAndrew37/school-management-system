import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import { TeacherLayoutShell } from "../_components/nav/TeacherLayoutShell";

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (
    !session ||
    !["teacher", "admin", "superadmin"].includes(session.profile.role)
  ) {
    redirect("/login?redirectTo=/teacher");
  }

  const assignment = await fetchMyClassTeacherAssignments();

  // FIX: Properly check and extract values from the union type
  const isClassTeacher = assignment?.isClassTeacher ?? false;

  // FIX: Extract the 'grade' strings from the 'classes' array to satisfy the shell's expectations
  const classGrades = assignment?.classes
    ? assignment.classes.map((c) => c.grade as string)
    : [];

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
