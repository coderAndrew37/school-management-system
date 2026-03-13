// components/teacher/ClassTeacherBanner.tsx
// Drop this inside the teacher dashboard page if the teacher is a class teacher.
// Server component — fetches its own data.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CalendarCheck, FileText, Star, Users } from "lucide-react";
import Link from "next/link";

async function getTodayAttendanceSummary(grade: string) {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().split("T")[0]!;

  // Student count
  const { count: total } = await supabase
    .from("students")
    .select("*", { count: "exact", head: true })
    .eq("current_grade", grade);

  // Today's attendance
  const { data: attended } = await supabase
    .from("attendance")
    .select("status")
    .eq("date", today)
    .in(
      "student_id",
      (
        await supabase.from("students").select("id").eq("current_grade", grade)
      ).data?.map((s: { id: string }) => s.id) ?? [],
    );

  const marked = attended?.length ?? 0;
  const absent =
    attended?.filter((r: { status: string }) => r.status === "Absent").length ??
    0;
  const present =
    attended?.filter(
      (r: { status: string }) => r.status === "Present" || r.status === "Late",
    ).length ?? 0;

  return { total: total ?? 0, marked, present, absent };
}

export async function ClassTeacherBanner() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: assignment } = await supabase
    .from("class_teacher_assignments")
    .select("grade, academic_year")
    .eq("teacher_id", user.id)
    .eq("academic_year", 2026)
    .maybeSingle();

  if (!assignment) return null;

  const summary = await getTodayAttendanceSummary(assignment.grade);
  const registerDone = summary.marked >= summary.total && summary.total > 0;

  return (
    <div className="bg-gradient-to-br from-sky-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-sky-200/50 relative overflow-hidden">
      {/* Decorative */}
      <div className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 rounded-full bg-white/[0.07]" />
      <div className="pointer-events-none absolute right-10 -bottom-6 h-20 w-20 rounded-full bg-white/[0.04]" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Star className="h-4 w-4 text-yellow-300 fill-yellow-300" />
          <p className="text-[10px] font-black uppercase tracking-widest text-sky-200">
            Class Teacher
          </p>
        </div>
        <p className="text-xl font-black">{assignment.grade}</p>
        <p className="text-sm text-sky-200 mt-0.5">
          {summary.total} students enrolled
        </p>

        {/* Today's register status */}
        <div className="mt-4 bg-white/10 rounded-xl p-3 flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-black tabular-nums">{summary.marked}</p>
            <p className="text-[9px] text-sky-200 font-bold uppercase tracking-wide">
              Marked
            </p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black tabular-nums text-emerald-300">
              {summary.present}
            </p>
            <p className="text-[9px] text-sky-200 font-bold uppercase tracking-wide">
              Present
            </p>
          </div>
          <div className="text-center">
            <p
              className={`text-2xl font-black tabular-nums ${summary.absent > 0 ? "text-rose-300" : "text-white"}`}
            >
              {summary.absent}
            </p>
            <p className="text-[9px] text-sky-200 font-bold uppercase tracking-wide">
              Absent
            </p>
          </div>
          <div className="ml-auto">
            {registerDone ? (
              <span className="text-[10px] font-black bg-emerald-400/20 border border-emerald-300/30 text-emerald-200 px-2.5 py-1 rounded-lg">
                ✓ Done today
              </span>
            ) : (
              <span className="text-[10px] font-black bg-amber-400/20 border border-amber-300/30 text-amber-200 px-2.5 py-1 rounded-lg animate-pulse">
                Pending
              </span>
            )}
          </div>
        </div>

        {/* Quick action links */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Link
            href="/teacher/class/attendance"
            className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 rounded-xl p-2.5 transition-colors"
          >
            <CalendarCheck className="h-4 w-4 text-white" />
            <span className="text-[9px] font-bold text-sky-100">Register</span>
          </Link>
          <Link
            href="/teacher/class/students"
            className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 rounded-xl p-2.5 transition-colors"
          >
            <Users className="h-4 w-4 text-white" />
            <span className="text-[9px] font-bold text-sky-100">My Class</span>
          </Link>
          <Link
            href="/teacher/class/reports"
            className="flex flex-col items-center gap-1 bg-white/10 hover:bg-white/20 rounded-xl p-2.5 transition-colors"
          >
            <FileText className="h-4 w-4 text-white" />
            <span className="text-[9px] font-bold text-sky-100">Reports</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
