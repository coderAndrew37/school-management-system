import { Users } from "lucide-react";
import { fetchTeachers } from "@/lib/data/dashboard";
import { TeachersTableClient } from "@/app/_components/teachers/TeachersTable";
import ListPageShell from "@/app/_components/shared/ListPageShell";

export const metadata = {
  title: "Teachers | Kibera Academy",
  description: "Full teacher register with search and sort",
};

export default async function TeachersPage() {
  const teachers = await fetchTeachers();

  return (
    <ListPageShell
      icon={<Users className="h-6 w-6 text-emerald-400" />}
      iconBg="bg-emerald-400/10 border-emerald-400/20"
      subtitle="Teaching Staff"
      title="Staff Register"
    >
      <TeachersTableClient teachers={teachers} />
    </ListPageShell>
  );
}
