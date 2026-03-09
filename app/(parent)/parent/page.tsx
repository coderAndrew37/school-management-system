import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import type { ChildWithAssessments } from "@/lib/types/parent";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  GraduationCap,
  Image,
  MessageSquare,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

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
          Contact the school office to link your child's enrolment record to
          this account.
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

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
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

          {/* Child switcher in top bar */}
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── Child hero card ───────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 p-6 text-white shadow-lg shadow-blue-200/50">
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.07]" />
          <div className="pointer-events-none absolute right-16 -bottom-10 h-28 w-28 rounded-full bg-white/[0.04]" />
          <div className="pointer-events-none absolute left-1/2 bottom-0 h-20 w-20 rounded-full bg-white/[0.03]" />

          <div className="relative flex items-center gap-5 flex-wrap">
            {/* Avatar */}
            <div className="h-16 w-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-black shrink-0 backdrop-blur-sm">
              {getInitials(activeChild.full_name)}
            </div>

            {/* Info */}
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
            </div>

            {/* Attendance pill */}
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

        {/* ── Quick nav tiles ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
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
              <div
                className={`h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform`}
              >
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

        {/* ── Two-column info grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Latest diary entry */}
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
                    {recentDiary.due_date && (
                      <p className="text-[10px] text-amber-500 font-semibold mt-1">
                        Due{" "}
                        {new Date(
                          recentDiary.due_date + "T00:00:00",
                        ).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-400">
                  {new Date(
                    recentDiary.diary_date + "T00:00:00",
                  ).toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
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

          {/* Recent assessments */}
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

          {/* Recent messages */}
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

        {/* ── Fee summary ───────────────────────────────────────────────────── */}
        {childData.feePayments.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-blue-500" />
                <p className="text-sm font-black text-slate-800">
                  Fee Payments
                </p>
              </div>
              <Link
                href="/parent/fees"
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                View all →
              </Link>
            </div>
            <div className="flex flex-wrap gap-3">
              {childData.feePayments.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  className={`rounded-xl border px-4 py-3 flex-1 min-w-[140px] ${
                    f.status === "paid"
                      ? "bg-emerald-50 border-emerald-100"
                      : f.status === "pending"
                        ? "bg-amber-50 border-amber-100"
                        : "bg-rose-50 border-rose-100"
                  }`}
                >
                  <p className="text-xs font-bold text-slate-600">
                    Term {f.term} · {f.academic_year}
                  </p>
                  <p className="text-lg font-black text-slate-800 mt-0.5">
                    KES {f.amount.toLocaleString()}
                  </p>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      f.status === "paid"
                        ? "text-emerald-600"
                        : f.status === "pending"
                          ? "text-amber-600"
                          : "text-rose-600"
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Announcements ─────────────────────────────────────────────────── */}
        {childData.announcements.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-sm font-black text-slate-800 mb-3">
              📢 School Notices
            </p>
            <div className="space-y-2.5">
              {childData.announcements.slice(0, 3).map((a) => (
                <div
                  key={a.id}
                  className={`rounded-xl border p-3 ${a.priority === "urgent" ? "bg-rose-50 border-rose-100" : "bg-slate-50 border-slate-100"}`}
                >
                  <p className="text-xs font-bold text-slate-700">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                    {a.body}
                  </p>
                </div>
              ))}
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
