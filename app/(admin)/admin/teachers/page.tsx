import { Users } from "lucide-react";
import { fetchTeachers } from "@/lib/data/dashboard";
// Updated import to point to the index file in the teachers_table folder
import ListPageShell from "@/app/_components/shared/ListPageShell";
import { getActiveTermYear } from "@/lib/utils/settings";
import TeachersIndex from "@/app/_components/teachers/teachers_table/Index";

export const metadata = {
  title: "Teachers | Kibali Academy",
  description: "Full teacher register with search, filter and management",
};

// Always fresh — edits need to reflect immediately
export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const [teachers, { academicYear }] = await Promise.all([
    fetchTeachers(),
    getActiveTermYear(),
  ]);

  return (
    <ListPageShell
      icon={<Users className="h-6 w-6 text-emerald-400" />}
      iconBg="bg-emerald-400/10 border-emerald-400/20"
      subtitle="Teaching Staff"
      title="Staff Register"
    >
      {/* Using the default export from teachers_table/index.tsx 
          Passing the fetched data down as initialTeachers
      */}
      <TeachersIndex initialTeachers={teachers} academicYear={academicYear} />
    </ListPageShell>
  );
}
