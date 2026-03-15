// app/admin/parents/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchAllParents } from "@/lib/data/parents";
import { HeartHandshake } from "lucide-react";
import ListPageShell from "@/app/_components/shared/ListPageShell";
import { ParentsTableClient } from "@/app/_components/parents/ParentsTableClient";

export const metadata = {
  title: "Parents | Kibali Academy Admin",
  description: "Parent and guardian register",
};
export const revalidate = 0;

export default async function ParentsPage() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login?redirectTo=/admin/parents");
  }

  const parents = await fetchAllParents();

  return (
    <ListPageShell
      icon={<HeartHandshake className="h-6 w-6 text-sky-400" />}
      iconBg="bg-sky-400/10 border-sky-400/20"
      subtitle="Parents & Guardians"
      title="Parent Register"
    >
      <ParentsTableClient parents={parents} />
    </ListPageShell>
  );
}
