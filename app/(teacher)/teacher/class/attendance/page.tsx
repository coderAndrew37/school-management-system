// app/teacher/class/attendance/page.tsx
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import { fetchClassStudents } from "@/lib/data/assessment";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClassAttendanceClient } from "./ClassAttendanceClient";
import type { ParentContact, Status } from "./attendance-types";

export const metadata = { title: "Class Register | Kibali Teacher Portal" };
export const revalidate = 0; 

interface Props {
  searchParams: Promise<{ classId?: string; date?: string; tab?: string }>;
}

// Strict interface for Supabase Attendance rows
interface AttendanceRow {
  student_id: string;
  status: Status;
  date: string;
  remarks: string | null;
}

// Strict interface for Supabase Parent Join
interface RawParentJoin {
  student_id: string;
  parents: {
    id: string;
    full_name: string;
    email: string | null;
    phone_number: string | null;
  } | {
    id: string;
    full_name: string;
    email: string | null;
    phone_number: string | null;
  }[] | null;
}

function toLocalDate(d: Date): string {
  const offset = d.getTimezoneOffset();
  const adjusted = new Date(d.getTime() - offset * 60 * 1000);
  return adjusted.toISOString().split("T")[0];
}

export default async function ClassAttendancePage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const sp = await searchParams;

  // 1. Auth & Teacher Identity Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, full_name")
    .eq("id", user.id)
    .single();

  if (!teacher) redirect("/login");

  // 2. Fetch Assigned Classes
  const assignment = await fetchMyClassTeacherAssignments();

  if (!assignment?.isClassTeacher || !assignment.classes?.length) {
    redirect("/teacher/attendance");
  }

  const availableClasses = assignment.classes as {
    id: string;
    grade: string;
    stream: string;
  }[];

  // 3. Resolve Active Class & Guard against "undefined" strings
  const rawClassId = sp.classId;
  const isValidId = rawClassId && rawClassId !== "undefined" && rawClassId.length > 10;
  
  const activeClass = isValidId
    ? availableClasses.find((c) => c.id === rawClassId)
    : availableClasses[0];

  if (!activeClass || rawClassId !== activeClass.id) {
    redirect(`/teacher/class/attendance?classId=${availableClasses[0].id}`);
  }

  const tabParam = sp.tab === "trends" ? "trends" : "register";
  const today = toLocalDate(new Date());
  const selectedDate =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today
      ? sp.date
      : today;

  // 4. Student Data Retrieval
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

    supabaseAdmin
      .from("student_parents")
      .select("student_id, parents (id, full_name, email, phone_number)")
      .in("student_id", studentIds),
  ]);

  // 7. Data Transformation
  const preFill: Record<string, { status: Status; remarks: string }> = {};
  (dateAttRes.data as AttendanceRow[] ?? []).forEach((r) => {
    preFill[r.student_id] = { status: r.status, remarks: r.remarks ?? "" };
  });

  const weekDatesRecorded = [
    ...new Set((weekAttRes.data as { date: string }[] ?? []).map((r) => r.date)),
  ];

  const attendanceHistory: Record<string, { date: string; status: Status }[]> = {};
  (historyRes.data as AttendanceRow[] ?? []).forEach((r) => {
    if (!attendanceHistory[r.student_id]) attendanceHistory[r.student_id] = [];
    attendanceHistory[r.student_id].push({ date: r.date, status: r.status });
  });

  // 8. Weekly Trend Aggregation
  const weekBuckets: Record<string, { present: number; total: number }> = {};
  (historyRes.data as AttendanceRow[] ?? []).forEach((r) => {
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

  // 9. Parent Mapping with Null-to-String Transformation
  const parentsByStudent: Record<string, ParentContact[]> = {};
  
  (parentsRes.data as unknown as RawParentJoin[] ?? []).forEach((r) => {
    if (r.parents) {
      if (!parentsByStudent[r.student_id]) parentsByStudent[r.student_id] = [];
      
      const sanitize = (p: { id: string; full_name: string; email: string | null; phone_number: string | null }): ParentContact => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email ?? "",
        phone_number: p.phone_number ?? "",
      });

      if (Array.isArray(r.parents)) {
        parentsByStudent[r.student_id].push(...r.parents.map(sanitize));
      } else {
        parentsByStudent[r.student_id].push(sanitize(r.parents));
      }
    }
  });

  const studentsWithParents = students.map((s) => ({
    ...s,
    parents: parentsByStudent[s.id] ?? [],
  }));

  // 10. Final Output
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