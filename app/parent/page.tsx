import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, GraduationCap, Users, CalendarDays } from "lucide-react";
import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types/dashboard";
import { TopNav } from "../_components/nav/TopNav";

export const metadata = {
  title: "Parent Portal | Kibali Academy",
};

// RLS will automatically filter to the parent's children
async function fetchParentChildren(): Promise<Student[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      `
      id, readable_id, full_name, date_of_birth, gender, current_grade,
      parent_id, upi_number, created_at
    `,
    )
    .order("full_name");

  if (error) {
    console.error("fetchParentChildren:", error);
    return [];
  }
  return (data ?? []) as Student[];
}

interface AssessmentSummary {
  student_id: string;
  subject_name: string;
  score: "EE" | "ME" | "AE" | "BE" | null;
  term: number;
}

async function fetchChildrenAssessments(
  studentIds: string[],
): Promise<AssessmentSummary[]> {
  if (studentIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assessments")
    .select("student_id, subject_name, score, term")
    .in("student_id", studentIds)
    .eq("academic_year", 2026)
    .order("term");
  if (error) return [];
  return (data ?? []) as AssessmentSummary[];
}

const SCORE_COLORS = {
  EE: "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
  ME: "bg-sky-400/10 text-sky-400 border-sky-400/25",
  AE: "bg-amber-400/10 text-amber-400 border-amber-400/25",
  BE: "bg-rose-400/10 text-rose-400 border-rose-400/25",
};

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export default async function ParentDashboard() {
  const session = await getSession();

  if (!session || session.profile.role !== "parent") {
    redirect("/login");
  }

  const children = await fetchParentChildren();
  const assessments = await fetchChildrenAssessments(children.map((c) => c.id));

  // Group assessments by student
  const assessmentsByChild: Record<string, AssessmentSummary[]> = {};
  for (const a of assessments) {
    if (!assessmentsByChild[a.student_id])
      assessmentsByChild[a.student_id] = [];
    assessmentsByChild[a.student_id]!.push(a);
  }

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <TopNav profile={session.profile} email={session.user.email ?? ""} />

      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 right-1/3 w-96 h-96 rounded-full bg-sky-500/[0.04] blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-amber-500/[0.04] blur-[110px]" />
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/70">
            Parent Portal
          </p>
          <h1 className="text-2xl font-bold text-white mt-1">
            Welcome, {session.profile.full_name?.split(" ")[0] ?? "Parent"}
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Academic Year 2026 · Kibali Academy
          </p>
        </header>

        {/* Children */}
        {children.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-white/10 text-center">
            <p className="text-4xl mb-3">🎒</p>
            <p className="text-white/50 font-medium">
              No children linked to your account
            </p>
            <p className="text-white/25 text-sm mt-1">
              Contact the school office to link your child's enrolment to this
              account.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {children.map((child) => {
              const childAssessments = assessmentsByChild[child.id] ?? [];
              const latestTerm = Math.max(
                ...childAssessments.map((a) => a.term),
                0,
              );
              const termAssessments = childAssessments.filter(
                (a) => a.term === latestTerm,
              );

              // Score distribution
              const counts = { EE: 0, ME: 0, AE: 0, BE: 0 };
              for (const a of termAssessments) {
                if (a.score && a.score in counts) counts[a.score]++;
              }

              return (
                <div
                  key={child.id}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden"
                >
                  {/* Child header */}
                  <div className="px-6 py-5 flex items-center gap-4 border-b border-white/[0.06]">
                    <div className="h-12 w-12 rounded-xl bg-sky-400/10 border border-sky-400/20 flex items-center justify-center text-sm font-bold text-sky-400 flex-shrink-0">
                      {child.full_name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white">{child.full_name}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          {child.current_grade}
                        </span>
                        <span className="text-xs text-white/40 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          Age {calcAge(child.date_of_birth)}
                        </span>
                        {child.readable_id && (
                          <span className="text-xs font-mono text-amber-400/60">
                            {child.readable_id}
                          </span>
                        )}
                      </div>
                    </div>
                    {latestTerm > 0 && (
                      <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/30 border border-white/10 rounded-lg px-2.5 py-1">
                        Term {latestTerm} results
                      </span>
                    )}
                  </div>

                  {/* Assessments */}
                  {termAssessments.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <p className="text-sm text-white/30">
                        No assessment results available yet.
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 space-y-4">
                      {/* Score summary */}
                      <div className="grid grid-cols-4 gap-3">
                        {(
                          Object.entries(counts) as [
                            keyof typeof counts,
                            number,
                          ][]
                        ).map(([score, count]) => (
                          <div
                            key={score}
                            className={`rounded-xl border px-3 py-2.5 text-center ${SCORE_COLORS[score]}`}
                          >
                            <p className="text-lg font-bold tabular-nums">
                              {count}
                            </p>
                            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 mt-0.5">
                              {score}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Subject list */}
                      <div className="space-y-1.5">
                        {termAssessments.map((a, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-2.5"
                          >
                            <p className="text-sm text-white/70">
                              {a.subject_name}
                            </p>
                            {a.score ? (
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${SCORE_COLORS[a.score]}`}
                              >
                                {a.score}
                              </span>
                            ) : (
                              <span className="text-xs text-white/25">—</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy Parent Portal · Contact admin@kibali.ac.ke for
            support
          </p>
        </footer>
      </main>
    </div>
  );
}
