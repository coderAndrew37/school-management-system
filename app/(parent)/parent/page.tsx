import { getSession } from "@/lib/actions/auth";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  XCircle,
} from "lucide-react";
import { redirect } from "next/navigation";

import { TopNav } from "@/app/_components/nav/TopNav";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Student } from "@/lib/types/dashboard";
import { ParentPortalHub } from "./_components/ParentPortalHub";
import { fetchAllChildData } from "@/lib/data/parent";

export const metadata = { title: "Parent Portal | Kibali Academy" };
export const revalidate = 0;

async function fetchParentChildren(): Promise<Student[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, readable_id, full_name, date_of_birth, gender, current_grade, parent_id, upi_number, created_at",
    )
    .order("full_name");
  if (error) return [];
  return (data ?? []) as Student[];
}

function calcAge(dob: string): number {
  const b = new Date(dob);
  const n = new Date();
  let age = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) age--;
  return age;
}

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function ParentDashboard({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.profile.role !== "parent") redirect("/login");

  const { child: childParam } = await searchParams;
  const children = await fetchParentChildren();

  if (children.length === 0) {
    return (
      <div className="min-h-screen bg-[#0c0f1a]">
        <TopNav profile={session.profile} email={session.user.email ?? ""} />
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <p className="text-5xl mb-4">🎒</p>
          <p className="text-white font-semibold text-lg">
            No children linked to your account
          </p>
          <p className="text-white/40 text-sm mt-2 max-w-sm leading-relaxed">
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

  const thisMonthAttend = childData.attendance.filter((r) => {
    const d = new Date(r.date);
    return (
      d.getMonth() === new Date().getMonth() &&
      d.getFullYear() === new Date().getFullYear()
    );
  });
  const presentCount = thisMonthAttend.filter(
    (r) => r.status === "present" || r.status === "late",
  ).length;
  const absentCount = thisMonthAttend.filter(
    (r) => r.status === "absent",
  ).length;
  const attendRate =
    thisMonthAttend.length > 0
      ? Math.round((presentCount / thisMonthAttend.length) * 100)
      : null;

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <TopNav profile={session.profile} email={session.user.email ?? ""} />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute top-0 right-1/3 h-[500px] w-[700px] rounded-full bg-sky-500/[0.03] blur-[160px]" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-amber-500/[0.03] blur-[130px]" />
        <div className="absolute top-1/2 right-0 h-60 w-60 rounded-full bg-purple-500/[0.03] blur-[120px]" />
      </div>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/70">
              Parent Portal
            </p>
            <h1 className="text-2xl font-bold text-white mt-1">
              {session.profile.full_name?.split(" ")[0] ?? "Parent"}'s Dashboard
            </h1>
            <p className="text-xs text-white/35 mt-1">
              Academic Year 2026 · Kibali Academy
            </p>
          </div>
          {childData.unreadCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-sky-400/25 bg-sky-400/10 px-4 py-2.5">
              <Bell className="h-4 w-4 text-sky-400" />
              <p className="text-xs font-bold text-sky-400">
                {childData.unreadCount} unread notification
                {childData.unreadCount !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </header>

        {/* Child selector */}
        {children.length > 1 && (
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mr-2">
              Child:
            </p>
            {children.map((child) => {
              const isActive = child.id === activeChild.id;
              return (
                <a
                  key={child.id}
                  href={`/parent?child=${child.id}`}
                  className={[
                    "flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all",
                    isActive
                      ? "border-sky-400/30 bg-sky-400/10 text-white"
                      : "border-white/[0.07] bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.05]",
                  ].join(" ")}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${isActive ? "bg-sky-400/20 text-sky-400" : "bg-white/5 text-white/40"}`}
                  >
                    {child.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((n: string) => n[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span>{child.full_name.split(" ")[0]}</span>
                  <span className="text-xs font-normal text-white/35 flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" />
                    {child.current_grade}
                  </span>
                  {isActive && (
                    <ChevronRight className="h-3.5 w-3.5 text-sky-400" />
                  )}
                </a>
              );
            })}
          </div>
        )}

        {/* Child profile strip */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="h-14 w-14 rounded-2xl bg-sky-400/15 border border-sky-400/25 flex items-center justify-center text-lg font-bold text-sky-400 flex-shrink-0">
              {activeChild.full_name
                .split(" ")
                .slice(0, 2)
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-white">
                {activeChild.full_name}
              </p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <GraduationCap className="h-3 w-3" />
                  {activeChild.current_grade}
                </span>
                <span className="flex items-center gap-1 text-xs text-white/40">
                  <CalendarDays className="h-3 w-3" />
                  Age {calcAge(activeChild.date_of_birth)}
                </span>
                {activeChild.readable_id && (
                  <span className="font-mono text-xs text-amber-400/60">
                    {activeChild.readable_id}
                  </span>
                )}
              </div>
            </div>
            {thisMonthAttend.length > 0 && (
              <div className="flex items-center gap-4">
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-2.5 text-center">
                  <p className="text-xl font-bold text-emerald-400 tabular-nums">
                    {attendRate ?? "—"}%
                  </p>
                  <p className="text-[9px] uppercase tracking-widest text-emerald-400/50 mt-0.5">
                    Attendance
                  </p>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-white/50">
                      {presentCount} present
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <XCircle className="h-3.5 w-3.5 text-rose-400" />
                    <span className="text-white/50">{absentCount} absent</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Portal Hub */}
        <ParentPortalHub
          child={activeChild}
          data={childData}
          senderRole="parent"
        />

        <footer className="border-t border-white/[0.05] pt-6 text-center">
          <p className="text-xs text-white/20">
            Kibali Academy Parent Portal · admin@kibali.ac.ke
          </p>
        </footer>
      </main>
    </div>
  );
}
