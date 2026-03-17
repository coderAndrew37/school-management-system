// app/teacher/layout.tsx

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
  )
    redirect("/login?redirectTo=/teacher");

  const assignment = await fetchMyClassTeacherAssignments();
  const isClassTeacher = assignment?.isClassTeacher ?? false;
  const classGrades = assignment?.grades ?? [];

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
