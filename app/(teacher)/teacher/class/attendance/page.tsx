// app/teacher/class/attendance/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import { fetchClassStudents } from "@/lib/data/assessment";
import { ClassAttendanceClient } from "./ClassAttendanceClient";

export const metadata = { title: "Class Register | Kibali Teacher Portal" };
export const revalidate = 0; // Ensure fresh data on every load

interface Props {
  searchParams: Promise<{ classId?: string; date?: string; tab?: string }>;
}

/** * Simple helper to format dates for Supabase (YYYY-MM-DD)
 * and avoid timezone-related shifting.
 */
function toLocalDate(d: Date): string {
  const offset = d.getTimezoneOffset();
  const adjusted = new Date(d.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().split("T")[0];
}

export default async function ClassAttendancePage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const sp = await searchParams;

  // 1. Auth & Teacher Identity Check
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

  // 2. Fetch Assigned Classes (Server Action)
  const assignment = await fetchMyClassTeacherAssignments();

  if (!assignment?.isClassTeacher || !assignment.classes?.length) {
    redirect("/teacher/attendance");
  }

  /**
   * Explicitly cast classes to match the expected AttendanceClientProps
   * to fix the "Property 'id' does not exist" error.
   */
  const availableClasses = assignment.classes as {
    id: string;
    grade: string;
    stream: string;
  }[];

  // 3. Resolve Active Class & Tab
  // Find the class based on classId in URL, or default to the first assigned class
  const activeClass = sp.classId
    ? availableClasses.find((c) => c.id === sp.classId)
    : availableClasses[0];

  // Safety: If classId in URL is invalid for this teacher, redirect to their primary class
  if (!activeClass) {
    redirect(`/teacher/class/attendance?classId=${availableClasses[0].id}`);
  }

  const tabParam = sp.tab === "trends" ? "trends" : "register";
  const today = toLocalDate(new Date());
  const selectedDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today
      ? sp.date
      : today;

  // 4. Student Data Retrieval (Now using the unique class UUID)
  const students = await fetchClassStudents(activeClass.id);
  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return (
      <ClassAttendanceClient
        classId={activeClass.id}
        gradeName={activeClass.grade}
        streamName={activeClass.stream}
        availableClasses={availableClasses}
        students={[]}
        studentsWithParents={[]}
        selectedDate={selectedDate}
        today={today}
        preFill={{}}
        weekDatesRecorded={[]}
        attendanceHistory={{}}
        classWeeklyTrend={[]}
        activeTab={tabParam}
        teacherName={teacher.full_name}
      />
    );
  }

  // 5. Date Range Calculations
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const weekStart = new Date(selectedDate + "T00:00:00");
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);

  // 6. Parallel Data Fetching
  const [dateAttRes, weekAttRes, historyRes, parentsRes] = await Promise.all([
    // Today's records for the register
    supabase
      .from("attendance")
      .select("student_id, status, remarks")
      .in("student_id", studentIds)
      .eq("date", selectedDate),

    // Dates recorded this week for the navigation dots
    supabase
      .from("attendance")
      .select("date")
      .in("student_id", studentIds)
      .gte("date", toLocalDate(weekStart))
      .lte("date", toLocalDate(weekEnd)),

    // 30-day history for stats and charts
    supabase
      .from("attendance")
      .select("student_id, date, status")
      .in("student_id", studentIds)
      .gte("date", toLocalDate(thirtyDaysAgo))
      .order("date", { ascending: true }),

    // Parent info via ADMIN (Bypass RLS)
    supabaseAdmin
      .from("student_parents")
      .select("student_id, parents (id, full_name, email, phone_number)")
      .in("student_id", studentIds),
  ]);

  // 7. Data Transformation & Initialization
  const preFill: Record<string, { status: string; remarks: string }> = {};
  (dateAttRes.data ?? []).forEach((r: any) => {
    preFill[r.student_id] = { status: r.status, remarks: r.remarks ?? "" };
  });

  const weekDatesRecorded = [
    ...new Set((weekAttRes.data ?? []).map((r: any) => r.date)),
  ];

  const attendanceHistory: Record<string, any[]> = {};
  (historyRes.data ?? []).forEach((r: any) => {
    if (!attendanceHistory[r.student_id]) attendanceHistory[r.student_id] = [];
    attendanceHistory[r.student_id].push({ date: r.date, status: r.status });
  });

  // 8. Weekly Trend Aggregation (Class-level)
  const weekBuckets: Record<string, { present: number; total: number }> = {};
  (historyRes.data ?? []).forEach((r: any) => {
    const d = new Date(r.date + "T00:00:00");
    const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = toLocalDate(mon);

    if (!weekBuckets[key]) weekBuckets[key] = { present: 0, total: 0 };
    weekBuckets[key].total++;
    if (r.status === "Present" || r.status === "Late")
      weekBuckets[key].present++;
  });

  const classWeeklyTrend = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([week, { present, total }]) => ({
      week: new Date(week + "T00:00:00").toLocaleDateString("en-KE", {
        day: "numeric",
        month: "short",
      }),
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
      present,
      absent: total - present,
      total,
    }));

  // 9. Parent Mapping
  const parentsByStudent: Record<string, any[]> = {};
  (parentsRes.data ?? []).forEach((r: any) => {
    if (r.parents) {
      if (!parentsByStudent[r.student_id]) parentsByStudent[r.student_id] = [];
      parentsByStudent[r.student_id].push(r.parents);
    }
  });

  const studentsWithParents = students.map((s) => ({
    ...s,
    parents: parentsByStudent[s.id] ?? [],
  }));

  // 10. Pass everything to the Client component
  return (
    <ClassAttendanceClient
      classId={activeClass.id}
      gradeName={activeClass.grade}
      streamName={activeClass.stream}
      availableClasses={availableClasses}
      students={students}
      studentsWithParents={studentsWithParents}
      selectedDate={selectedDate}
      today={today}
      preFill={preFill}
      weekDatesRecorded={weekDatesRecorded}
      attendanceHistory={attendanceHistory}
      classWeeklyTrend={classWeeklyTrend}
      activeTab={tabParam}
      teacherName={teacher.full_name}
    />
  );
}
