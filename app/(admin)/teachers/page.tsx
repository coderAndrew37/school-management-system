// import Link from "next/link";
// import { ArrowLeft, GraduationCap } from "lucide-react";
// import { fetchAllStudents } from "@/lib/data/dashboard";
// import { StudentsTableClient } from "@/app/_components/students/StudentsTableClient";

// export const metadata = {
//   title: "Students | Kibali Academy",
//   description: "Full student register with search, filter and sort",
// };
// export const revalidate = 60;

// export default async function StudentsPage() {
//   const students = await fetchAllStudents();
//   const uniqueGrades = [
//     ...new Set(students.map((s) => s.current_grade)),
//   ].sort();

//   return (
//     <ListPageShell
//       icon={<GraduationCap className="h-6 w-6 text-amber-400" />}
//       iconBg="bg-amber-400/10 border-amber-400/20"
//       subtitle="Students"
//       title="Student Register"
//     >
//       <StudentsTableClient students={students} uniqueGrades={uniqueGrades} />
//     </ListPageShell>
//   );
// }

// ─────────────────────────────────────────────────────────────────────────────
// FILE 2: app/teachers/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

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
