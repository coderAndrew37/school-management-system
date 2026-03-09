import { redirect } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  Users,
  GraduationCap,
  ClipboardList,
  Clock,
  MessageSquare,
  BookMarked,
  ChevronRight,
  Award,
} from "lucide-react";
import { getSession } from "@/lib/actions/auth";
import { fetchTeacherAssessmentAllocations } from "@/lib/data/assessment";
import type { SubjectLevel } from "@/lib/types/allocation";
import { TopNav } from "@/app/_components/nav/TopNav";
import { ClassTeacherBanner } from "@/app/_components/teachers/ClassTeacherBanner";

export const metadata = { title: "Teacher Portal | Kibali Academy" };
export const revalidate = 0;

// ── Design tokens ─────────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<
  SubjectLevel,
  { label: string; card: string; badge: string; dot: string; accent: string }
> = {
  lower_primary: {
    label: "Lower Primary",
    card: "border-amber-200 bg-amber-50/60 hover:bg-amber-50",
    badge: "bg-amber-100 text-amber-700 border border-amber-200",
    dot: "bg-amber-400",
    accent: "text-amber-700",
  },
  upper_primary: {
    label: "Upper Primary",
    card: "border-sky-200 bg-sky-50/60 hover:bg-sky-50",
    badge: "bg-sky-100 text-sky-700 border border-sky-200",
    dot: "bg-sky-400",
    accent: "text-sky-700",
  },
  junior_secondary: {
    label: "Junior Secondary",
    card: "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    dot: "bg-emerald-500",
    accent: "text-emerald-700",
  },
};

// What teachers give parents in CBC context
const TEACHER_TOOLS = [
  {
    href: "/teacher/assess",
    icon: ClipboardList,
    label: "Assess Students",
    desc: "Enter CBC strand scores · EE ME AE BE",
    color: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
    text: "text-white",
    primary: true,
  },
  {
    href: "/teacher/attendance",
    icon: Calendar,
    label: "Mark Attendance",
    desc: "Daily roll call · visible to parents",
    color:
      "bg-white hover:bg-slate-50 shadow-slate-100 border border-slate-200",
    text: "text-slate-800",
    primary: false,
  },
  {
    href: "/teacher/diary",
    icon: BookMarked,
    label: "Diary & Homework",
    desc: "Assignments · due dates · parent view",
    color:
      "bg-white hover:bg-slate-50 shadow-slate-100 border border-slate-200",
    text: "text-slate-800",
    primary: false,
  },
  {
    href: "/teacher/messages",
    icon: MessageSquare,
    label: "Messages",
    desc: "Communication book · parent threads",
    color:
      "bg-white hover:bg-slate-50 shadow-slate-100 border border-slate-200",
    text: "text-slate-800",
    primary: false,
  },
  {
    href: "/timetable",
    icon: Clock,
    label: "Timetable",
    desc: "View your weekly schedule",
    color:
      "bg-white hover:bg-slate-50 shadow-slate-100 border border-slate-200",
    text: "text-slate-800",
    primary: false,
  },
  {
    href: "/teacher/pathway",
    icon: Award,
    label: "JSS Pathways",
    desc: "Career guidance · Grade 7–9 learners",
    color:
      "bg-white hover:bg-slate-50 shadow-slate-100 border border-slate-200",
    text: "text-slate-800",
    primary: false,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TeacherDashboard() {
  const session = await getSession();
  if (!session || session.profile.role !== "teacher") redirect("/login");

  const teacherId = session.profile.teacher_id;

  if (!teacherId) {
    return (
      <div className="min-h-screen bg-[#F8F7F2]">
        <TopNav profile={session.profile} email={session.user.email ?? ""} />

        <ClassTeacherBanner />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <p className="text-4xl mb-4">⚠️</p>
          <p className="text-slate-800 font-bold text-lg">Account not linked</p>
          <p className="text-slate-500 text-sm mt-2 max-w-sm leading-relaxed">
            Your account hasn't been linked to a teacher record. Contact the
            school administrator.
          </p>
        </div>
      </div>
    );
  }

  const allocations = await fetchTeacherAssessmentAllocations(teacherId, 2026);
  const uniqueGrades = [...new Set(allocations.map((a) => a.grade))];
  const totalStudents =
    allocations.reduce((sum, a, _, arr) => {
      // count unique students: sum counts for unique grades only
      const seen = new Set<string>();
      arr.forEach((x) => {
        if (!seen.has(x.grade)) {
          seen.add(x.grade);
        }
      });
      return sum;
    }, 0) ||
    allocations.reduce((max, a, _, arr) => {
      const gradeSet = new Set(arr.map((x) => x.grade));
      return arr
        .filter(
          (x, i, self) => self.findIndex((y) => y.grade === x.grade) === i,
        )
        .reduce((s, x) => s + x.studentCount, 0);
    }, 0);

  // Deduplicated student total across grades
  const uniqueStudentTotal = allocations
    .filter((a, i, arr) => arr.findIndex((b) => b.grade === a.grade) === i)
    .reduce((sum, a) => sum + a.studentCount, 0);

  const firstName = session.profile.full_name?.split(" ")[0] ?? "Teacher";

  // Group allocations by level
  const byLevel: Record<string, typeof allocations> = {};
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
    <div className="min-h-screen bg-[#F8F7F2] font-[family-name:var(--font-body)]">
      <TopNav profile={session.profile} email={session.user.email ?? ""} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-500 p-6 text-white shadow-lg shadow-emerald-200">
          <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.08]" />
          <div className="pointer-events-none absolute right-16 -bottom-10 h-28 w-28 rounded-full bg-white/[0.05]" />

          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-200">
              Teacher Portal · Kibali Academy
            </p>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-sm text-emerald-100/80">
              Academic Year 2026 · CBC Competency-Based Curriculum
            </p>

            {/* Inline stats in hero */}
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              {[
                { label: "Subjects", value: allocations.length },
                { label: "Grades", value: uniqueGrades.length },
                { label: "Learners", value: uniqueStudentTotal },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm"
                >
                  <span className="text-xl font-black tabular-nums">
                    {value}
                  </span>
                  <span className="text-xs font-semibold text-emerald-100/70">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Quick actions ─────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TEACHER_TOOLS.map(
              ({ href, icon: Icon, label, desc, color, text, primary }) => (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "group flex flex-col gap-2.5 rounded-2xl p-4 shadow-sm transition-all active:scale-[0.98]",
                    color,
                    primary ? "sm:col-span-1" : "",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "flex h-9 w-9 items-center justify-center rounded-xl",
                      primary
                        ? "bg-white/20"
                        : "bg-slate-100 group-hover:bg-emerald-50",
                    ].join(" ")}
                  >
                    <Icon
                      className={[
                        "h-4.5 w-4.5",
                        primary
                          ? "text-white"
                          : "text-slate-600 group-hover:text-emerald-700",
                      ].join(" ")}
                    />
                  </div>
                  <div>
                    <p
                      className={["text-sm font-bold leading-tight", text].join(
                        " ",
                      )}
                    >
                      {label}
                    </p>
                    <p
                      className={[
                        "text-[11px] mt-0.5 leading-snug",
                        primary ? "text-white/70" : "text-slate-400",
                      ].join(" ")}
                    >
                      {desc}
                    </p>
                  </div>
                </Link>
              ),
            )}
          </div>
        </section>

        {/* ── Subject allocations ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <GraduationCap className="h-3.5 w-3.5" />
              Your Subject Allocations
            </h2>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-lg px-2.5 py-1">
              {allocations.length} subject{allocations.length !== 1 ? "s" : ""}
            </span>
          </div>

          {allocations.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center bg-white">
              <p className="text-3xl mb-3">📋</p>
              <p className="text-slate-600 font-semibold">
                No subjects allocated yet
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Contact the school administrator.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {LEVEL_ORDER.filter((l) => byLevel[l]).map((level) => {
                const cfg = LEVEL_CONFIG[level];
                return (
                  <div key={level}>
                    {/* Level header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                      <p
                        className={`text-[10px] font-black uppercase tracking-widest ${cfg.accent}`}
                      >
                        {cfg.label}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {byLevel[level]!.map((alloc) => (
                        <Link
                          key={alloc.id}
                          href={`/teacher/assess?alloc=${alloc.id}&term=1`}
                          className={[
                            "group flex flex-col gap-3 rounded-2xl border p-5 transition-all active:scale-[0.99] shadow-sm",
                            cfg.card,
                          ].join(" ")}
                        >
                          {/* Top row */}
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
                              className={`flex-shrink-0 font-mono text-[10px] font-bold px-2 py-1 rounded-lg ${cfg.badge}`}
                            >
                              {alloc.subjectCode}
                            </span>
                          </div>

                          {/* Bottom row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                              <Users className="h-3 w-3" />
                              {alloc.studentCount} learner
                              {alloc.studentCount !== 1 ? "s" : ""}
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                              <Clock className="h-3 w-3" />
                              {alloc.weeklyLessons} lessons/wk
                              <ChevronRight
                                className={`h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5 ${cfg.accent}`}
                              />
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── CBC value banner ──────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
              <BookOpen className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">
                What you record here reaches parents instantly
              </p>
              <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                Every assessment score, attendance mark, diary entry and message
                you save is visible to parents in real time through the Kibali
                parent portal — giving families true insight into their child's
                CBC learning journey.
              </p>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {[
                  "Assessments",
                  "Attendance",
                  "Diary",
                  "Messages",
                  "JSS Pathway",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-200 pt-5 text-center">
          <p className="text-xs text-slate-400 font-medium">
            Kibali Academy Teacher Portal · admin@kibali.ac.ke
          </p>
        </footer>
      </main>
    </div>
  );
}
