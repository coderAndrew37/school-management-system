import { TopNav } from "@/app/_components/nav/TopNav";
import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import type { ChildWithAssessments } from "@/lib/types/parent";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  XCircle,
} from "lucide-react";
import { redirect } from "next/navigation";
import { ParentPortalHub } from "./_components/ParentPortalHub";

export const metadata = { title: "Parent Portal | Kibali Academy" };
export const revalidate = 0;

function calcAge(dob: string): number {
  const b = new Date(dob),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (
    n.getMonth() - b.getMonth() < 0 ||
    (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())
  )
    a--;
  return a;
}

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function ParentDashboard({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.profile.role !== "parent") redirect("/login");

  const { child: childParam } = await searchParams;

  // ── Use fetchMyChildren — RLS-scoped, correct join, no parent_id column ──
  const children: ChildWithAssessments[] = await fetchMyChildren();

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopNav profile={session.profile} email={session.user.email ?? ""} />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <p className="text-5xl mb-4">🎒</p>
          <p className="text-slate-800 font-bold text-lg">
            No children linked to your account
          </p>
          <p className="text-slate-500 text-sm mt-2 max-w-sm leading-relaxed">
            Contact the school office to link your child's enrolment record to
            this parent account.
          </p>
        </div>
      </div>
    );
  }

  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;

  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.current_grade,
  );

  // ── Attendance summary for this month ─────────────────────────────────────
  const thisMonthAttend = childData.attendance.filter((r) => {
    const d = new Date(r.date);
    return (
      d.getMonth() === new Date().getMonth() &&
      d.getFullYear() === new Date().getFullYear()
    );
  });
  const presentCount = thisMonthAttend.filter(
    (r) => r.status === "Present" || r.status === "Late",
  ).length;
  const absentCount = thisMonthAttend.filter(
    (r) => r.status === "Absent",
  ).length;
  const attendRate =
    thisMonthAttend.length > 0
      ? Math.round((presentCount / thisMonthAttend.length) * 100)
      : null;

  const firstName = session.profile.full_name?.split(" ")[0] ?? "Parent";

  return (
    <div className="min-h-screen bg-slate-50 font-[family-name:var(--font-body)]">
      <TopNav profile={session.profile} email={session.user.email ?? ""} />

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── Hero strip ─────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-6 text-white shadow-lg shadow-blue-200">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.07]" />
          <div className="pointer-events-none absolute right-12 -bottom-12 h-32 w-32 rounded-full bg-white/[0.04]" />

          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-200">
                Parent Portal
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">
                {firstName}'s Dashboard
              </h1>
              <p className="mt-1 text-sm text-blue-200">
                Academic Year 2026 · Kibali Academy
              </p>
            </div>
            {childData.unreadCount > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-4 py-2.5 backdrop-blur-sm">
                <Bell className="h-4 w-4" />
                <p className="text-sm font-bold">
                  {childData.unreadCount} unread
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Child switcher ─────────────────────────────────────────────────── */}
        {children.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">
              Child:
            </p>
            {children.map((child) => {
              const isActive = child.id === activeChild.id;
              const initials = child.full_name
                .split(" ")
                .slice(0, 2)
                .map((n: string) => n[0])
                .join("")
                .toUpperCase();
              return (
                <a
                  key={child.id}
                  href={`/parent?child=${child.id}`}
                  className={[
                    "flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all",
                    isActive
                      ? "border-blue-200 bg-white text-blue-700 shadow-sm shadow-blue-100"
                      : "border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-600",
                  ].join(" ")}
                >
                  <span
                    className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      isActive
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {initials}
                  </span>
                  <span>{child.full_name.split(" ")[0]}</span>
                  <span className="flex items-center gap-1 text-xs font-normal text-slate-400">
                    <GraduationCap className="h-3 w-3" />
                    {child.current_grade}
                  </span>
                  {isActive && (
                    <ChevronRight className="h-3.5 w-3.5 text-blue-500" />
                  )}
                </a>
              );
            })}
          </div>
        )}

        {/* ── Active child card ──────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-lg font-black text-blue-600 flex-shrink-0">
              {activeChild.full_name
                .split(" ")
                .slice(0, 2)
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-slate-800">
                {activeChild.full_name}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <GraduationCap className="h-3 w-3" />
                  {activeChild.current_grade}
                </span>
                <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                  <CalendarDays className="h-3 w-3" />
                  Age {calcAge(activeChild.date_of_birth)}
                </span>
                {activeChild.readable_id && (
                  <span className="font-mono text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                    {activeChild.readable_id}
                  </span>
                )}
              </div>
            </div>

            {thisMonthAttend.length > 0 && (
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "rounded-2xl border px-4 py-2.5 text-center",
                    (attendRate ?? 0) >= 90
                      ? "border-emerald-200 bg-emerald-50"
                      : (attendRate ?? 0) >= 75
                        ? "border-amber-200 bg-amber-50"
                        : "border-red-200 bg-red-50",
                  ].join(" ")}
                >
                  <p
                    className={[
                      "text-xl font-black tabular-nums",
                      (attendRate ?? 0) >= 90
                        ? "text-emerald-600"
                        : (attendRate ?? 0) >= 75
                          ? "text-amber-600"
                          : "text-red-600",
                    ].join(" ")}
                  >
                    {attendRate ?? "—"}%
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                    This month
                  </p>
                </div>
                <div className="space-y-1.5 hidden sm:block">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {presentCount} present
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    {absentCount} absent
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Portal hub ─────────────────────────────────────────────────────── */}
        <ParentPortalHub
          child={activeChild}
          data={childData}
          senderRole="parent"
        />

        <footer className="border-t border-slate-200 pt-5 text-center">
          <p className="text-xs text-slate-400 font-medium">
            Kibali Academy Parent Portal · admin@kibali.ac.ke
          </p>
        </footer>
      </main>
    </div>
  );
}
