// app/teacher/layout.tsx
// Wraps all /teacher/* pages in the sidebar layout.
// Server component — fetches session, passes profile to client shell.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { TeacherLayoutShell } from "./_components/nav/TeacherLayoutShell";

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

  return (
    <TeacherLayoutShell
      profile={session.profile}
      email={session.user.email ?? ""}
    >
      {children}
    </TeacherLayoutShell>
  );
}
