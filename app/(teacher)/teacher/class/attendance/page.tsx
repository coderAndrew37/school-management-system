// app/teacher/class/attendance/page.tsx

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import { fetchClassStudents } from "@/lib/data/assessment";
import { ClassAttendanceClient } from "./ClassAttendanceClient";
import { ClassGradeSelector } from "@/app/(teacher)/_components/ClassGradeSelector";

export const metadata = { title: "Class Register | Kibali Teacher Portal" };
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ grade?: string; date?: string; tab?: string }>;
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ClassAttendancePage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, full_name")
    .eq("id", user.id)
    .single();
  if (!teacher) redirect("/login");

  const assignment = await fetchMyClassTeacherAssignments();
  if (!assignment?.isClassTeacher || assignment.grades.length === 0)
    redirect("/teacher/attendance");

  const { grades } = assignment;
  const sp = await searchParams;
  const tabParam = sp.tab === "trends" ? "trends" : "register";

  const activeGrade =
    sp.grade && grades.includes(sp.grade)
      ? sp.grade
      : grades.length === 1
        ? grades[0]!
        : null;

  if (!activeGrade) {
    return (
      <ClassGradeSelector
        grades={grades}
        currentPath="/teacher/class/attendance"
      />
    );
  }

  const today = toLocalDate(new Date());
  const selectedDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today
      ? sp.date
      : today;

  const students = await fetchClassStudents(activeGrade);
  const studentIds = students.map((s) => s.id);

  // ── Week range for nav dots ───────────────────────────────────────────────
  const weekStart = new Date(selectedDate + "T00:00:00");
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);

  // ── 30-day lookback ───────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  if (studentIds.length === 0) {
    return (
      <ClassAttendanceClient
        teacherName={teacher.full_name}
        grade={activeGrade}
        grades={grades}
        students={[]}
        studentsWithParents={[]}
        selectedDate={selectedDate}
        today={today}
        preFill={{}}
        weekDatesRecorded={[]}
        attendanceHistory={{}}
        classWeeklyTrend={[]}
        activeTab={tabParam}
      />
    );
  }

  // ── All queries in parallel ───────────────────────────────────────────────
  const [dateAttRes, weekAttRes, historyRes, parentsRes] = await Promise.all([
    supabase
      .from("attendance")
      .select("student_id, status, remarks")
      .in("student_id", studentIds)
      .eq("date", selectedDate),

    supabase
      .from("attendance")
      .select("date")
      .in("student_id", studentIds)
      .gte("date", toLocalDate(weekStart))
      .lte("date", toLocalDate(weekEnd)),

    supabase
      .from("attendance")
      .select("student_id, date, status")
      .in("student_id", studentIds)
      .gte("date", toLocalDate(thirtyDaysAgo))
      .order("date", { ascending: true }),

    // Use supabaseAdmin to bypass RLS — teachers can't read parents table directly
    supabaseAdmin
      .from("student_parents")
      .select("student_id, parents ( id, full_name, email, phone_number )")
      .in("student_id", studentIds),
  ]);

  // ── preFill ───────────────────────────────────────────────────────────────
  type AttRow = { student_id: string; status: string; remarks: string | null };
  const preFill: Record<string, { status: string; remarks: string }> = {};
  for (const r of (dateAttRes.data ?? []) as AttRow[]) {
    preFill[r.student_id] = { status: r.status, remarks: r.remarks ?? "" };
  }

  // ── Week indicator dots ───────────────────────────────────────────────────
  type DateRow = { date: string };
  const weekDatesRecorded = [
    ...new Set((weekAttRes.data ?? []).map((r) => (r as DateRow).date)),
  ];

  // ── 30-day history ────────────────────────────────────────────────────────
  type AttStatus = "Present" | "Absent" | "Late" | "Excused";
  type HistoryRow = { student_id: string; date: string; status: AttStatus };
  const attendanceHistory: Record<
    string,
    { date: string; status: AttStatus }[]
  > = {};
  for (const r of (historyRes.data ?? []) as unknown as HistoryRow[]) {
    if (!attendanceHistory[r.student_id]) attendanceHistory[r.student_id] = [];
    attendanceHistory[r.student_id]!.push({ date: r.date, status: r.status });
  }

  // ── Weekly class trend (last 5 weeks Mon-Fri, rate per week) ─────────────
  type WeekPoint = {
    week: string;
    rate: number;
    present: number;
    absent: number;
    total: number;
  };
  const allHistory = (historyRes.data ?? []) as unknown as HistoryRow[];
  const weekBuckets: Record<string, { present: number; total: number }> = {};
  for (const r of allHistory) {
    const d = new Date(r.date + "T00:00:00");
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = toLocalDate(mon);
    if (!weekBuckets[key]) weekBuckets[key] = { present: 0, total: 0 };
    weekBuckets[key]!.total++;
    if (r.status === "Present" || r.status === "Late")
      weekBuckets[key]!.present++;
  }
  const classWeeklyTrend: WeekPoint[] = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([week, { present, total }]) => {
      const absent = total - present;
      const d = new Date(week + "T00:00:00");
      const label = d.toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
      });
      return {
        week: label,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
        present,
        absent,
        total,
      };
    });

  // ── Parent contacts (via admin to bypass RLS) ─────────────────────────────
  type ParentObj = {
    id: string;
    full_name: string;
    email: string;
    phone_number: string | null;
  } | null;
  type JoinRow = { student_id: string; parents: ParentObj };
  const parentsByStudent: Record<
    string,
    {
      id: string;
      full_name: string;
      email: string;
      phone_number: string | null;
    }[]
  > = {};
  for (const r of (parentsRes.data ?? []) as unknown as JoinRow[]) {
    if (!r.parents) continue;
    if (!parentsByStudent[r.student_id]) parentsByStudent[r.student_id] = [];
    parentsByStudent[r.student_id]!.push(r.parents);
  }

  const studentsWithParents = students.map((s) => ({
    ...s,
    parents: parentsByStudent[s.id] ?? [],
  }));

  return (
    <ClassAttendanceClient
      teacherName={teacher.full_name}
      grade={activeGrade}
      grades={grades}
      students={students}
      studentsWithParents={studentsWithParents}
      selectedDate={selectedDate}
      today={today}
      preFill={preFill}
      weekDatesRecorded={weekDatesRecorded}
      attendanceHistory={attendanceHistory}
      classWeeklyTrend={classWeeklyTrend}
      activeTab={tabParam}
    />
  );
}
