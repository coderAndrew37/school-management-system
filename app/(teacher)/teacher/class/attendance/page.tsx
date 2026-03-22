// app/teacher/class/attendance/page.tsx

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
  const gradeParam = sp.grade;
  const dateParam = sp.date;
  const tabParam = sp.tab === "trends" ? "trends" : "register";

  const activeGrade =
    gradeParam && grades.includes(gradeParam)
      ? gradeParam
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
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam <= today
      ? dateParam
      : today;

  const students = await fetchClassStudents(activeGrade);
  const studentIds = students.map((s) => s.id);

  // Week range for indicator dots
  const weekStart = new Date(selectedDate + "T00:00:00");
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4);

  // 30-day lookback for trends
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [dateAttRes, weekAttRes, historyRes, parentsRes] = await Promise.all([
    // Today's attendance for the register
    studentIds.length > 0
      ? supabase
          .from("attendance")
          .select("student_id, status, remarks")
          .in("student_id", studentIds)
          .eq("date", selectedDate)
      : Promise.resolve({ data: [] }),

    // Week records for indicator dots
    studentIds.length > 0
      ? supabase
          .from("attendance")
          .select("date")
          .in("student_id", studentIds)
          .gte("date", toLocalDate(weekStart))
          .lte("date", toLocalDate(weekEnd))
      : Promise.resolve({ data: [] }),

    // 30-day history for trends
    studentIds.length > 0
      ? supabase
          .from("attendance")
          .select("student_id, date, status")
          .in("student_id", studentIds)
          .gte("date", toLocalDate(thirtyDaysAgo))
          .order("date", { ascending: true })
      : Promise.resolve({ data: [] }),

    // Parent contacts — join through student_parents → parents
    studentIds.length > 0
      ? supabase
          .from("student_parents")
          .select("student_id, parents ( full_name, email, phone_number )")
          .in("student_id", studentIds)
      : Promise.resolve({ data: [] }),
  ]);

  // Build preFill
  const preFill: Record<string, { status: string; remarks: string }> = {};
  for (const r of (dateAttRes.data ?? []) as {
    student_id: string;
    status: string;
    remarks: string | null;
  }[]) {
    preFill[r.student_id] = { status: r.status, remarks: r.remarks ?? "" };
  }

  // Dates with records this week
  const weekDatesRecorded = [
    ...new Set((weekAttRes.data ?? []).map((r: { date: string }) => r.date)),
  ];

  // 30-day history grouped by studentId
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

  // Parent contacts grouped by studentId
  type ParentJoinRow = {
    student_id: string;
    parents: {
      full_name: string;
      email: string;
      phone_number: string | null;
    } | null;
  };
  const parentsByStudent: Record<
    string,
    { full_name: string; email: string; phone_number: string | null }[]
  > = {};
  for (const r of (parentsRes.data ?? []) as unknown as ParentJoinRow[]) {
    if (!r.parents) continue;
    if (!parentsByStudent[r.student_id]) parentsByStudent[r.student_id] = [];
    parentsByStudent[r.student_id]!.push(r.parents);
  }

  // Merge parents onto students
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
      activeTab={tabParam}
    />
  );
}
