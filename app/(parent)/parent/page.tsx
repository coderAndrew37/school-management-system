// app/parent/page.tsx  (replaces parent-page-redesigned.tsx)
// Updated: adds MyChildTodayWidget, school notices strip, upcoming events strip.

import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import type { ChildWithAssessments } from "@/lib/types/parent";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Image,
  Info,
  MessageSquare,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MyChildTodayWidget } from "./_components/ParentOverviewWidget";

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

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatShort(iso: string) {
  const d = new Date(iso + (iso.includes("T") ? "" : "T00:00:00"));
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

function daysFromNow(iso: string) {
  const diff =
    new Date(iso + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0);
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return null;
  if (days <= 7) return `In ${days} days`;
  return null;
}

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function ParentDashboard({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.profile.role !== "parent") redirect("/login");

  const _sp = await searchParams;
  const childParam = _sp?.child;
  const children: ChildWithAssessments[] = await fetchMyChildren();

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
        <p className="text-6xl mb-4">🎒</p>
        <p className="text-slate-800 font-black text-xl">No children linked</p>
        <p className="text-slate-500 text-sm mt-2 max-w-sm leading-relaxed">
          Contact the school office to link your child&apos;s enrolment record
          to this account.
        </p>
      </div>
    );
  }

  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;
  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.current_grade,
  );

  // ── Attendance stats (this month) ─────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const thisMonthAttend = childData.attendance.filter((r) => {
    const d = new Date(r.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
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

  // ── Today's attendance ────────────────────────────────────────────────────
  const todayAtt =
    childData.attendance.find((a) => a.date.slice(0, 10) === todayStr) ?? null;

  // ── Latest assessments ────────────────────────────────────────────────────
  const latestAssessments = activeChild.assessments
    .filter((a) => a.score)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 4);

  const SCORE_COLORS: Record<string, string> = {
    EE: "bg-emerald-100 text-emerald-700 border-emerald-200",
    ME: "bg-blue-100 text-blue-700 border-blue-200",
    AE: "bg-amber-100 text-amber-700 border-amber-200",
    BE: "bg-rose-100 text-rose-700 border-rose-200",
  };

  const firstName = session.profile.full_name?.split(" ")[0] ?? "Parent";
  const recentDiary = childData.diary[0] ?? null;
  const lastScore = activeChild.assessments.find((a) => a.score) ?? null;

  // ── Upcoming events (next 30 days) ────────────────────────────────────────
  const upcomingEvents = childData.events
    .filter((e) => {
      const diff =
        new Date(e.start_date + "T00:00:00").getTime() -
        new Date().setHours(0, 0, 0, 0);
      return diff >= 0 && diff <= 30 * 86400000;
    })
    .slice(0, 3);

  // ── Active announcements ──────────────────────────────────────────────────
  const activeAnn = childData.announcements
    .filter((a) => !a.expires_at || new Date(a.expires_at) > now)
    .slice(0, 3);

  const urgentAnn = activeAnn.filter((a) => a.priority === "urgent");

  // ── Today status config ───────────────────────────────────────────────────
  const ATT_CONFIG: Record<
    string,
    { icon: string; text: string; cls: string }
  > = {
    Present: {
      icon: "✅",
      text: "At school today",
      cls: "bg-emerald-50 border-emerald-200 text-emerald-700",
    },
    Absent: {
      icon: "❌",
      text: "Absent today",
      cls: "bg-rose-50 border-rose-200 text-rose-700",
    },
    Late: {
      icon: "🕐",
      text: "Arrived late",
      cls: "bg-amber-50 border-amber-200 text-amber-700",
    },
    Excused: {
      icon: "📋",
      text: "Excused absence",
      cls: "bg-sky-50 border-sky-200 text-sky-700",
    },
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* ── Urgent announcement banner ────────────────────────────────────── */}
      {urgentAnn.length > 0 && (
        <div className="bg-rose-500 text-white px-4 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="text-xs font-bold flex-1 line-clamp-1">
            {urgentAnn[0]!.title}
          </p>
          <Link
            href="/parent/announcements"
            className="text-xs font-black underline shrink-0"
          >
            View →
          </Link>
        </div>
      )}

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400 font-semibold">
              Welcome back,
            </p>
            <p className="text-sm font-black text-slate-800 leading-none">
              {firstName}
            </p>
          </div>

          {children.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              {children.map((child) => {
                const active = child.id === activeChild.id;
                return (
                  <a
                    key={child.id}
                    href={`/parent?child=${child.id}`}
                    className={[
                      "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap border transition-all shrink-0",
                      active
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                        : "bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600",
                    ].join(" ")}
                  >
                    <span
                      className={`h-5 w-5 rounded-md flex items-center justify-center text-[9px] font-black ${active ? "bg-white/20" : "bg-slate-100"}`}
                    >
                      {getInitials(child.full_name)}
                    </span>
                    {child.full_name.split(" ")[0]}
                  </a>
                );
              })}
            </div>
          )}

          {childData.unreadCount > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 shrink-0">
              <Bell className="h-3.5 w-3.5" />
              {childData.unreadCount}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* ── Child hero card ───────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 p-6 text-white shadow-lg shadow-blue-200/50">
          <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.07]" />
          <div className="pointer-events-none absolute right-16 -bottom-10 h-28 w-28 rounded-full bg-white/[0.04]" />

          <div className="relative flex items-center gap-5 flex-wrap">
            <div className="h-16 w-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-black shrink-0 backdrop-blur-sm">
              {getInitials(activeChild.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-xl tracking-tight">
                {activeChild.full_name}
              </p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs font-semibold text-blue-200">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {activeChild.current_grade}
                </span>
                <span className="text-xs text-blue-200 font-semibold">
                  Age {calcAge(activeChild.date_of_birth)}
                </span>
                {activeChild.readable_id && (
                  <span className="font-mono text-xs font-bold text-amber-300 bg-white/10 px-2 py-0.5 rounded-lg">
                    #{activeChild.readable_id}
                  </span>
                )}
              </div>

              {/* Today status inline */}
              {todayAtt && ATT_CONFIG[todayAtt.status] && (
                <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-xl px-3 py-1.5">
                  <span className="text-sm">
                    {ATT_CONFIG[todayAtt.status]!.icon}
                  </span>
                  <span className="text-xs font-bold text-white/90">
                    {ATT_CONFIG[todayAtt.status]!.text}
                  </span>
                </div>
              )}
            </div>

            {attendRate !== null && (
              <div className="text-center bg-white/10 border border-white/20 rounded-2xl px-5 py-3 backdrop-blur-sm">
                <p className="text-3xl font-black tabular-nums">
                  {attendRate}%
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200 mt-0.5">
                  Attendance
                </p>
                <div className="flex items-center justify-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-[10px] text-white/70">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" />{" "}
                    {presentCount}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-white/70">
                    <XCircle className="h-3 w-3 text-rose-300" /> {absentCount}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── My Child Today widget ────────────────────────────────────────── */}
        {/* Shows today's attendance status, last diary entry, last CBC score. */}
        {/* Renders nothing if there is no data yet — no empty state needed.   */}
        <MyChildTodayWidget
          child={activeChild}
          attendance={childData.attendance}
          diary={childData.diary}
        />

        {/* ── Quick nav tiles ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Diary",
              href: "/parent/diary",
              icon: BookOpen,
              color: "text-amber-500",
              bg: "bg-amber-50",
              border: "border-amber-100",
              count: childData.diary.length,
            },
            {
              label: "Messages",
              href: "/parent/messages",
              icon: MessageSquare,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              border: "border-emerald-100",
              count: childData.messages.filter((m) => !m.is_read).length,
            },
            {
              label: "Gallery",
              href: "/parent/gallery",
              icon: Image,
              color: "text-purple-600",
              bg: "bg-purple-50",
              border: "border-purple-100",
              count: childData.gallery.length,
            },
            {
              label: "Academics",
              href: "/parent/academics",
              icon: TrendingUp,
              color: "text-blue-600",
              bg: "bg-blue-50",
              border: "border-blue-100",
              count: activeChild.assessments.length,
            },
          ].map(({ label, href, icon: Icon, color, bg, border, count }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-2 rounded-2xl border ${border} ${bg} p-3.5 hover:shadow-sm transition-all group`}
            >
              <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-700">{label}</p>
                {count > 0 && (
                  <p className={`text-xs font-black ${color}`}>{count}</p>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* ── School Notices + Upcoming Events (side by side on desktop) ────── */}
        {(activeAnn.length > 0 || upcomingEvents.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Notices */}
            {activeAnn.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Bell className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <p className="text-sm font-black text-slate-800">
                      School Notices
                    </p>
                  </div>
                  <Link
                    href="/parent/announcements"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    All <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {activeAnn.map((a) => (
                    <Link
                      key={a.id}
                      href="/parent/announcements"
                      className={`block rounded-xl border p-3 hover:shadow-sm transition-all ${
                        a.priority === "urgent"
                          ? "bg-rose-50 border-rose-200"
                          : "bg-slate-50 border-slate-100 hover:border-indigo-100"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {a.priority === "urgent" ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                        ) : (
                          <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 line-clamp-1">
                            {a.title}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                            {a.body}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming events */}
            {upcomingEvents.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <CalendarDays className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                    <p className="text-sm font-black text-slate-800">
                      Coming Up
                    </p>
                  </div>
                  <Link
                    href="/parent/announcements"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    Calendar <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {upcomingEvents.map((e) => {
                    const badge = daysFromNow(e.start_date);
                    return (
                      <Link
                        key={e.id}
                        href="/parent/announcements"
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 hover:border-indigo-100 p-3 transition-all hover:shadow-sm"
                      >
                        <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center shrink-0">
                          <p className="text-xs font-black text-indigo-700 leading-none">
                            {new Date(e.start_date + "T00:00:00").getDate()}
                          </p>
                          <p className="text-[8px] text-indigo-400 font-bold">
                            {new Date(
                              e.start_date + "T00:00:00",
                            ).toLocaleDateString("en-KE", { month: "short" })}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 line-clamp-1">
                            {e.title}
                          </p>
                          {e.description && (
                            <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                              {e.description}
                            </p>
                          )}
                        </div>
                        {badge && (
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-lg shrink-0 ${
                              badge === "Today"
                                ? "bg-rose-100 text-rose-600"
                                : badge === "Tomorrow"
                                  ? "bg-amber-100 text-amber-600"
                                  : "bg-indigo-50 text-indigo-600"
                            }`}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Two-column info grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Latest diary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                <p className="text-sm font-black text-slate-800">
                  Latest Diary
                </p>
              </div>
              <Link
                href="/parent/diary"
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                View all →
              </Link>
            </div>
            {recentDiary ? (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-700 leading-snug">
                    {recentDiary.title}
                  </p>
                  {recentDiary.subject_name && (
                    <span className="shrink-0 text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-100 rounded-lg px-2 py-0.5">
                      {recentDiary.subject_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {recentDiary.body}
                </p>
                {recentDiary.homework && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-600 mb-1">
                      📚 Homework
                    </p>
                    <p className="text-xs text-amber-800 leading-relaxed line-clamp-2">
                      {recentDiary.homework}
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-slate-400">
                  {new Date(
                    recentDiary.diary_date + "T00:00:00",
                  ).toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "long",
                  })}
                  {" · "}
                  {recentDiary.author_name}
                </p>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-2xl mb-1">📔</p>
                <p className="text-xs text-slate-400">No diary entries yet</p>
              </div>
            )}
          </div>

          {/* Recent grades */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <p className="text-sm font-black text-slate-800">
                  Recent Grades
                </p>
              </div>
              <Link
                href="/parent/academics"
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Full report →
              </Link>
            </div>
            {latestAssessments.length > 0 ? (
              <div className="space-y-2.5">
                {latestAssessments.map((a) => (
                  <div key={a.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {a.subject_name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {a.strand_id}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded-xl border shrink-0 ${a.score ? SCORE_COLORS[a.score] : "bg-slate-100 text-slate-400 border-slate-200"}`}
                    >
                      {a.score ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-2xl mb-1">📊</p>
                <p className="text-xs text-slate-400">
                  No assessments recorded yet
                </p>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-500" />
                <p className="text-sm font-black text-slate-800">Messages</p>
              </div>
              <Link
                href="/parent/messages"
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                View all →
              </Link>
            </div>
            {childData.messages.length > 0 ? (
              <div className="space-y-2.5">
                {childData.messages.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3 ${!m.is_read && m.sender_role !== "parent" ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-100"}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                        {m.sender_name}
                      </span>
                      {!m.is_read && m.sender_role !== "parent" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      )}
                    </div>
                    {m.subject && (
                      <p className="text-xs font-bold text-slate-700 mb-0.5">
                        {m.subject}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 line-clamp-2">
                      {m.body}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-2xl mb-1">💬</p>
                <p className="text-xs text-slate-400">No messages yet</p>
              </div>
            )}
          </div>

          {/* Gallery preview */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-purple-500" />
                <p className="text-sm font-black text-slate-800">Gallery</p>
              </div>
              <Link
                href="/parent/gallery"
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                View all →
              </Link>
            </div>
            {childData.gallery.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {childData.gallery.slice(0, 6).map((item) => {
                  const src = item.signedUrl || item.media_url;
                  return (
                    <Link key={item.id} href="/parent/gallery">
                      <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={src}
                            alt={item.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <Image className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-2xl mb-1">🖼️</p>
                <p className="text-xs text-slate-400">No gallery items yet</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Fee summary ────────────────────────────────────────────────── */}
        {childData.feePayments.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Wallet className="h-3.5 w-3.5 text-blue-500" />
                </div>
                <p className="text-sm font-black text-slate-800">
                  Fee Statement Summary
                </p>
              </div>
              <Link
                href="/parent/fees"
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View full statement <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {childData.feePayments.slice(0, 3).map((f) => {
                const isPaid = f.status.toLowerCase() === "paid";
                const isPending = f.status.toLowerCase() === "pending";

                return (
                  <div
                    key={f.id}
                    className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                      isPaid
                        ? "bg-emerald-50 border-emerald-100"
                        : isPending
                          ? "bg-amber-50 border-amber-100"
                          : "bg-rose-50 border-rose-100"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Term {f.term} • {f.academic_year}
                      </p>
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${
                          isPaid
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-white text-amber-700 border-amber-200"
                        }`}
                      >
                        {f.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-lg font-black text-slate-800 leading-none">
                        KES {f.amount_paid.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {isPaid
                          ? "Total cleared"
                          : `Balance: KES ${(f.total_due - f.amount_paid).toLocaleString()}`}
                      </p>
                    </div>

                    {!isPaid && (
                      <div className="mt-3 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{
                            width: `${Math.min((f.amount_paid / f.total_due) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <footer className="border-t border-slate-200 pt-5 text-center pb-6">
          <p className="text-xs text-slate-400 font-medium">
            Kibali Academy Parent Portal · admin@kibali.ac.ke
          </p>
        </footer>
      </main>
    </div>
  );
}
