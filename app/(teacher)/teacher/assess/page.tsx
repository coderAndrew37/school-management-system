// app/teacher/assess/page.tsx

import { BatchAssessmentGrid } from "@/app/_components/assessment/BatchAssessmentGrid";
import { getSession } from "@/lib/actions/auth";
import {
  fetchClassAssessments,
  fetchTeacherAssessmentAllocations,
  type TeacherAllocationSummary,
} from "@/lib/data/assessment";
import type { SubjectLevel } from "@/lib/types/allocation";
import { getActiveTermYear } from "@/lib/utils/settings";
import { ArrowLeft, BookOpen, ChevronRight, Clock, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Batch Assessment | Kibali Academy" };
export const revalidate = 0;

// ── Design tokens ─────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<
  SubjectLevel,
  { card: string; badge: string; accent: string; dot: string; label: string }
> = {
  lower_primary: {
    card: "border-amber-200 bg-amber-50/70 hover:bg-amber-50 hover:border-amber-300",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
    accent: "text-amber-700",
    dot: "bg-amber-400",
    label: "Lower Primary",
  },
  upper_primary: {
    card: "border-sky-200 bg-sky-50/70 hover:bg-sky-50 hover:border-sky-300",
    badge: "bg-sky-100 text-sky-700 border border-sky-200",
    accent: "text-sky-700",
    dot: "bg-sky-400",
    label: "Upper Primary",
  },
  junior_secondary: {
    card: "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50 hover:border-emerald-300",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    accent: "text-emerald-700",
    dot: "bg-emerald-500",
    label: "Junior Secondary",
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ alloc?: string; term?: string }>;
}

export default async function AssessPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (
    !session ||
    (session.profile.role !== "teacher" && session.profile.role !== "admin")
  )
    redirect("/login");

  const teacherId = session.profile.teacher_id;
  if (!teacherId) return <NoTeacherLinked />;

  const { alloc: allocId, term: termParam } = await searchParams;

  // Use school settings for default term/year — fallback to calendar heuristic
  const { term: defaultTerm, academicYear } = await getActiveTermYear();
  const term = (parseInt(termParam ?? String(defaultTerm), 10) ||
    defaultTerm) as 1 | 2 | 3;

  const allocations = await fetchTeacherAssessmentAllocations(
    teacherId,
    academicYear,
  );
  const selectedAlloc = allocId
    ? (allocations.find((a) => a.id === allocId) ?? null)
    : null;

  const classData = selectedAlloc
    ? await fetchClassAssessments(
        selectedAlloc.grade,
        selectedAlloc.subjectName,
        term,
        academicYear,
      )
    : null;

  return (
    <main className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <header>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3 font-medium">
          <Link
            href="/teacher"
            className="hover:text-emerald-700 transition-colors"
          >
            Teacher Portal
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-600">Batch Assessment</span>
          {selectedAlloc && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-slate-800 font-semibold">
                {selectedAlloc.subjectName} · {selectedAlloc.grade}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">
              CBC Assessment Entry
            </p>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              {selectedAlloc
                ? `${selectedAlloc.subjectName} — ${selectedAlloc.grade}`
                : "Batch Assessment"}
            </h1>
            {selectedAlloc && (
              <p className="text-sm text-slate-500 mt-1">
                Term {term} · {academicYear} · {classData?.students.length ?? 0}{" "}
                learners
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedAlloc && (
              <Link
                href="/teacher/assess"
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> All Subjects
              </Link>
            )}
            <Link
              href="/teacher"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {selectedAlloc && classData ? (
        <div className="space-y-5">
          {/* Term tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit shadow-sm">
            {([1, 2, 3] as const).map((t) => (
              <Link
                key={t}
                href={`/teacher/assess?alloc=${allocId}&term=${t}`}
                className={[
                  "rounded-lg px-5 py-2 text-xs font-bold transition-all",
                  term === t
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-50",
                ].join(" ")}
              >
                Term {t}
              </Link>
            ))}
          </div>

          <BatchAssessmentGrid
            students={classData.students}
            subjectName={selectedAlloc.subjectName}
            grade={selectedAlloc.grade}
            term={term}
            academicYear={academicYear}
            initialGrid={classData.gridState}
            prevTermScores={classData.prevTermScores}
            hasPrevTerm={classData.hasPrevTerm}
          />
        </div>
      ) : (
        <AllocPicker allocations={allocations} currentTerm={term} />
      )}

      <footer className="border-t border-slate-200 pt-5 text-center">
        <p className="text-xs text-slate-400 font-medium">
          Kibali Academy · CBC Assessment System · Term {term} · {academicYear}
        </p>
      </footer>
    </main>
  );
}

// ── Subject picker ────────────────────────────────────────────────────────────

function AllocPicker({
  allocations,
  currentTerm,
}: {
  allocations: TeacherAllocationSummary[];
  currentTerm: number;
}) {
  if (allocations.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center bg-white">
        <p className="text-4xl mb-4">📋</p>
        <p className="text-slate-600 font-semibold">No subjects allocated</p>
        <p className="text-slate-400 text-sm mt-1">
          Contact the school administrator to assign subjects.
        </p>
      </div>
    );
  }

  const byLevel: Record<string, TeacherAllocationSummary[]> = {};
  for (const a of allocations) {
    if (!byLevel[a.subjectLevel]) byLevel[a.subjectLevel] = [];
    byLevel[a.subjectLevel]!.push(a);
  }

  const LEVEL_ORDER: SubjectLevel[] = [
    "lower_primary",
    "upper_primary",
    "junior_secondary",
  ];

  return (
    <div className="space-y-7">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <p className="text-sm text-slate-600 leading-relaxed">
          Select a{" "}
          <span className="font-bold text-slate-800">subject and grade</span> to
          open the assessment spreadsheet. Enter CBC strand scores{" "}
          <span className="font-bold text-slate-800">(EE / ME / AE / BE)</span>{" "}
          for all learners at once — results are immediately visible to parents.
        </p>
      </div>

      {LEVEL_ORDER.filter((l) => byLevel[l]).map((level) => {
        const style = LEVEL_STYLE[level];
        return (
          <section key={level}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-2 w-2 rounded-full ${style.dot}`} />
              <h2
                className={`text-[10px] font-black uppercase tracking-widest ${style.accent}`}
              >
                {style.label}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byLevel[level]!.map((alloc) => (
                <Link
                  key={alloc.id}
                  href={`/teacher/assess?alloc=${alloc.id}&term=${currentTerm}`}
                  className={[
                    "group flex flex-col gap-3 rounded-2xl border p-5 transition-all duration-150 active:scale-[0.99] shadow-sm",
                    style.card,
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 leading-tight">
                        {alloc.subjectName}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        {alloc.grade}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] font-bold font-mono px-2 py-1 rounded-lg ${style.badge}`}
                    >
                      {alloc.subjectCode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                      <Users className="h-3 w-3" />
                      {alloc.studentCount} learner
                      {alloc.studentCount !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Clock className="h-3 w-3" />
                      {alloc.weeklyLessons}/wk
                    </span>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 text-[10px] font-semibold ${style.accent}`}
                  >
                    <BookOpen className="h-3 w-3 flex-shrink-0" />
                    Open assessment spreadsheet
                    <ChevronRight className="h-3 w-3 ml-auto transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function NoTeacherLinked() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <p className="text-4xl mb-4">⚠️</p>
      <p className="text-slate-800 font-bold text-lg">Account not linked</p>
      <p className="text-slate-500 text-sm mt-2 max-w-sm leading-relaxed">
        Your account hasn't been linked to a teacher record. Contact the school
        administrator.
      </p>
      <Link
        href="/teacher"
        className="mt-6 text-xs text-emerald-700 hover:text-emerald-800 font-semibold underline"
      >
        ← Back to dashboard
      </Link>
    </div>
  );
}
