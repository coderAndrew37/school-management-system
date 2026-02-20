import { BatchAssessmentGrid } from "@/app/_components/assessment/BatchAssessmentGrid";
import { TopNav } from "@/app/_components/nav/TopNav";
import { getSession } from "@/lib/actions/auth";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassAssessments,
  TeacherAllocationSummary,
} from "@/lib/data/assessment";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Batch Assessment | Kibali Academy" };
export const revalidate = 0; // always fresh — teachers need live data

// ── Level styles ──────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<
  string,
  { card: string; badge: string; text: string }
> = {
  lower_primary: {
    card: "border-amber-400/20 bg-amber-400/[0.04]",
    badge: "bg-amber-400/10 text-amber-400 border-amber-400/25",
    text: "text-amber-400",
  },
  upper_primary: {
    card: "border-sky-400/20 bg-sky-400/[0.04]",
    badge: "bg-sky-400/10 text-sky-400 border-sky-400/25",
    text: "text-sky-400",
  },
  junior_secondary: {
    card: "border-emerald-400/20 bg-emerald-400/[0.04]",
    badge: "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
    text: "text-emerald-400",
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
  ) {
    redirect("/login");
  }

  const teacherId = session.profile.teacher_id;
  if (!teacherId) {
    return (
      <NoTeacherLinked
        profile={session.profile}
        email={session.user.email ?? ""}
      />
    );
  }

  const { alloc: allocId, term: termParam } = await searchParams;
  const term = parseInt(termParam ?? "1", 10) as 1 | 2 | 3;
  const academicYear = 2026;

  // Fetch this teacher's allocations
  const allocations = await fetchTeacherAssessmentAllocations(
    teacherId,
    academicYear,
  );

  // If an allocation is selected, load the class grid
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
    <div className="min-h-screen bg-[#0c0f1a]">
      <TopNav profile={session.profile} email={session.user.email ?? ""} />

      {/* Ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute top-0 left-1/4 h-[500px] w-[700px] rounded-full bg-emerald-500/[0.03] blur-[160px]" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-500/[0.03] blur-[130px]" />
      </div>

      <main className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-white/35 mb-2">
              <Link
                href="/teacher"
                className="hover:text-white/60 transition-colors"
              >
                Teacher Portal
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-white/60">Batch Assessment</span>
              {selectedAlloc && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-white/60">
                    {selectedAlloc.subjectName} · {selectedAlloc.grade}
                  </span>
                </>
              )}
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70">
              CBC Assessment Entry
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">
              {selectedAlloc
                ? `${selectedAlloc.subjectName} — ${selectedAlloc.grade}`
                : "Batch Assessment"}
            </h1>
            {selectedAlloc && (
              <p className="text-xs text-white/35 mt-0.5">
                Term {term} · Academic Year {academicYear} ·{" "}
                {classData?.students.length ?? 0} students
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedAlloc && (
              <Link
                href="/teacher/assess"
                className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-white/50 hover:text-white hover:border-white/20 transition-all"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> All Subjects
              </Link>
            )}
            <Link
              href="/teacher"
              className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3.5 py-2 text-xs font-semibold text-white/50 hover:text-white hover:border-white/20 transition-all"
            >
              Dashboard
            </Link>
          </div>
        </header>

        {selectedAlloc && classData ? (
          /* ── Assessment grid view ─────────────────────────────────────────── */
          <div className="space-y-5">
            {/* Term selector tabs */}
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1 w-fit">
              {([1, 2, 3] as const).map((t) => (
                <Link
                  key={t}
                  href={`/teacher/assess?alloc=${allocId}&term=${t}`}
                  className={[
                    "rounded-lg px-5 py-2 text-xs font-semibold transition-all",
                    term === t
                      ? "bg-emerald-500 text-white shadow"
                      : "text-white/40 hover:text-white",
                  ].join(" ")}
                >
                  Term {t}
                </Link>
              ))}
            </div>

            {/* Grid */}
            <BatchAssessmentGrid
              students={classData.students}
              subjectName={selectedAlloc.subjectName}
              grade={selectedAlloc.grade}
              term={term}
              academicYear={academicYear}
              initialGrid={classData.gridState}
            />
          </div>
        ) : (
          /* ── Subject picker ──────────────────────────────────────────────── */
          <AllocPicker allocations={allocations} currentTerm={term} />
        )}

        <footer className="border-t border-white/[0.05] pt-6 text-center">
          <p className="text-xs text-white/20">
            Kibali Academy · CBC Assessment System · Term {term} ·{" "}
            {academicYear}
          </p>
        </footer>
      </main>
    </div>
  );
}

// ── Subject/grade picker grid ─────────────────────────────────────────────────

function AllocPicker({
  allocations,
  currentTerm,
}: {
  allocations: TeacherAllocationSummary[];
  currentTerm: number;
}) {
  if (allocations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 py-20 text-center">
        <p className="text-4xl mb-4">📋</p>
        <p className="text-white/50 font-medium">No subjects allocated</p>
        <p className="text-white/25 text-sm mt-1">
          Contact the school administrator to assign subjects.
        </p>
      </div>
    );
  }

  // Group by level
  const byLevel: Record<string, TeacherAllocationSummary[]> = {};
  for (const a of allocations) {
    if (!byLevel[a.subjectLevel]) byLevel[a.subjectLevel] = [];
    byLevel[a.subjectLevel]!.push(a);
  }

  const LEVEL_ORDER = ["lower_primary", "upper_primary", "junior_secondary"];
  const LEVEL_NAMES: Record<string, string> = {
    lower_primary: "Lower Primary",
    upper_primary: "Upper Primary",
    junior_secondary: "Junior Secondary",
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
        <p className="text-sm text-white/50">
          Select a{" "}
          <span className="text-white font-medium">subject &amp; grade</span>{" "}
          below to open the assessment spreadsheet for that class. You can enter
          CBC strand scores (EE / ME / AE / BE) for all students at once and
          generate AI narrative remarks.
        </p>
      </div>

      {LEVEL_ORDER.filter((l) => byLevel[l]).map((level) => {
        const style = LEVEL_STYLE[level] ?? LEVEL_STYLE.upper_primary;
        return (
          <section key={level}>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-3 flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5" />
              {LEVEL_NAMES[level]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {byLevel[level]!.map((alloc) => (
                <Link
                  key={alloc.id}
                  href={`/teacher/assess?alloc=${alloc.id}&term=${currentTerm}`}
                  className={`rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-150 hover:scale-[1.02] active:scale-100 ${style.card} hover:shadow-lg hover:shadow-black/20`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-white leading-tight">
                        {alloc.subjectName}
                      </p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {alloc.grade}
                      </p>
                    </div>
                    <span
                      className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border font-mono ${style.badge}`}
                    >
                      {alloc.subjectCode}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-semibold ${style.text}`}
                    >
                      {LEVEL_NAMES[level]}
                    </span>
                    <span className="flex items-center gap-1 text-white/30">
                      <Users className="h-3 w-3" />
                      {alloc.studentCount} student
                      {alloc.studentCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                    <BookOpen className="h-3 w-3 flex-shrink-0" />
                    Click to open assessment spreadsheet
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

// ── No teacher linked error state ─────────────────────────────────────────────

function NoTeacherLinked({
  profile,
  email,
}: {
  profile: Parameters<typeof TopNav>[0]["profile"];
  email: string;
}) {
  return (
    <div className="min-h-screen bg-[#0c0f1a]">
      <TopNav profile={profile} email={email} />
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <p className="text-4xl mb-4">⚠️</p>
        <p className="text-white font-semibold">
          Account not linked to a teacher record
        </p>
        <p className="text-white/40 text-sm mt-2 max-w-sm">
          Please contact the school administrator to link your account.
        </p>
        <Link
          href="/teacher"
          className="mt-6 text-xs text-emerald-400 hover:text-emerald-300 underline"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}
