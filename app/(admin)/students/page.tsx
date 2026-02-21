import { fetchAllStudents } from "@/lib/data/dashboard";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { StudentsTableClient } from "./StudentsTableClient";
import Link from "next/link";

export const metadata = {
  title: "Students | Kibali Academy",
  description: "Full student register with search, filter and sort",
};

export const revalidate = 60;

export default async function StudentsPage() {
  const students = await fetchAllStudents();
  const uniqueGrades = [
    ...new Set(students.map((s) => s.current_grade)),
  ].sort();

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 text-white/50" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20">
                <GraduationCap className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
                  Kibali Academy
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Student Register
                </h1>
              </div>
            </div>
          </div>
        </header>

        <StudentsTableClient students={students} uniqueGrades={uniqueGrades} />

        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy Portal · Data refreshes every 60 seconds
          </p>
        </footer>
      </div>
    </div>
  );
}

// import ListPageShell from "@/app/_components/shared/ListPageShell";
// import { fetchAllStudents } from "@/lib/data/dashboard";
// import { GraduationCap } from "lucide-react";
// import { StudentsTableClient } from "./StudentsTableClient";

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
