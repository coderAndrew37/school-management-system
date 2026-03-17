// ─────────────────────────────────────────────────────────────────────────────
// app/(admin)/layout.tsx  —  Server Component
// Route group layout for all admin pages.
// Handles session check once — all child pages no longer need getSession.
// Renders the AdminLayoutShell (client) which manages sidebar state.
// ─────────────────────────────────────────────────────────────────────────────

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { AdminLayoutShell } from "@/app/_components/nav/AdminLayoutShell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session || session.profile.role !== "admin") {
    redirect("/login");
  }

  return (
    <AdminLayoutShell
      profile={session.profile}
      email={session.user.email ?? ""}
    >
      {children}
    </AdminLayoutShell>
  );
}
