import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TeacherSubjectAllocation } from "@/lib/types/allocation";
import { BookOpen, Calendar, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TopNav } from "../_components/nav/TopNav";

export const metadata = {
  title: "Teacher Portal | Kibali Academy",
};

async function fetchTeacherAllocations(
  teacherId: string,
): Promise<TeacherSubjectAllocation[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
  id, teacher_id, subject_id, grade, academic_year, created_at,
  teachers!inner (
    id, full_name, email, tsc_number
  ),
  subjects!inner (
    id, name, code, level, weekly_lessons
  )
`,
    )
    .returns<TeacherSubjectAllocation[]>()

    .eq("teacher_id", teacherId)
    .eq("academic_year", 2026)
    .order("grade");

  if (error) return [];
  return data ?? [];
}

async function fetchStudentCountsByGrade(
  grades: string[],
): Promise<Record<string, number>> {
  if (grades.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("current_grade")
    .in("current_grade", grades);
  if (error) return {};
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { current_grade: string }[]) {
    counts[row.current_grade] = (counts[row.current_grade] ?? 0) + 1;
  }
  return counts;
}

const LEVEL_LABELS = {
  lower_primary: "Lower Primary",
  upper_primary: "Upper Primary",
  junior_secondary: "Junior Secondary",
};

const LEVEL_COLORS = {
  lower_primary: "text-amber-400 border-amber-400/25 bg-amber-400/10",
  upper_primary: "text-sky-400 border-sky-400/25 bg-sky-400/10",
  junior_secondary: "text-emerald-400 border-emerald-400/25 bg-emerald-400/10",
};

export default async function TeacherDashboard() {
  const session = await getSession();

  if (!session || session.profile.role !== "teacher") {
    redirect("/login");
  }

  const teacherId = session.profile.teacher_id;

  if (!teacherId) {
    return (
      <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
        <TopNav profile={session.profile} email={session.user.email ?? ""} />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-white font-semibold">Account not linked</p>
          <p className="text-white/40 text-sm mt-2 max-w-sm">
            Your account has not been linked to a teacher record yet. Please
            contact the school administrator.
          </p>
        </div>
      </div>
    );
  }

  const allocations = await fetchTeacherAllocations(teacherId);
  const uniqueGrades = [...new Set(allocations.map((a) => a.grade))];
  const studentCounts = await fetchStudentCountsByGrade(uniqueGrades);
  const totalStudents = Object.values(studentCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <TopNav profile={session.profile} email={session.user.email ?? ""} />

      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-emerald-500/4 blur-[130px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-amber-500/4 blur-[110px]" />
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70">
              Teacher Portal
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">
              {session.profile.full_name ?? "Teacher Dashboard"}
            </h1>
            <p className="text-sm text-white/40 mt-1">
              Academic Year 2026 · Kibali Academy
            </p>
          </div>
          <Link
            href="/timetable"
            className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/10 hover:bg-emerald-400/20 px-4 py-2.5 text-xs font-semibold text-emerald-400 transition-all"
          >
            <Calendar className="h-4 w-4" />
            View Timetable
          </Link>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Subjects", value: allocations.length, color: "emerald" },
            { label: "Grades", value: uniqueGrades.length, color: "amber" },
            { label: "Students", value: totalStudents, color: "sky" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className={`rounded-xl border px-4 py-3 text-center
                ${color === "emerald" ? "border-emerald-400/20 bg-emerald-400/5" : ""}
                ${color === "amber" ? "border-amber-400/20 bg-amber-400/5" : ""}
                ${color === "sky" ? "border-sky-400/20 bg-sky-400/5" : ""}
              `}
            >
              <p
                className={`text-2xl font-bold tabular-nums
                ${color === "emerald" ? "text-emerald-400" : ""}
                ${color === "amber" ? "text-amber-400" : ""}
                ${color === "sky" ? "text-sky-400" : ""}
              `}
              >
                {value}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Allocations */}
        <section>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Your Subject Allocations
          </h2>

          {allocations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
              <p className="text-white/30 text-sm">
                No subjects allocated yet.
              </p>
              <p className="text-white/20 text-xs mt-1">
                Contact the school administrator.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allocations.map((alloc) => {
                const level = alloc.subjects?.level ?? "upper_primary";
                const studentCount = studentCounts[alloc.grade] ?? 0;
                return (
                  <div
                    key={alloc.id}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/5 transition-colors p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-white leading-tight">
                          {alloc.subjects?.name}
                        </p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {alloc.grade}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-bold font-mono px-2 py-1 rounded-lg border ${LEVEL_COLORS[level]}`}
                      >
                        {alloc.subjects?.code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`text-[10px] uppercase tracking-wider ${LEVEL_COLORS[level].split(" ")[0]}`}
                      >
                        {LEVEL_LABELS[level]}
                      </span>
                      <span className="flex items-center gap-1 text-white/30">
                        <Users className="h-3 w-3" />
                        {studentCount} student{studentCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <footer className="pt-4 border-t border-white/5">
          <p className="text-center text-xs text-white/20">
            Kibali Academy Teacher Portal · Contact admin@kibali.ac.ke for
            support
          </p>
        </footer>
      </main>
    </div>
  );
}
