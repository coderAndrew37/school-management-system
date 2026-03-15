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
  searchParams: Promise<{ grade?: string }>;
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

  // Get ALL assigned grades — handles shortage scenario
  const assignment = await fetchMyClassTeacherAssignments();
  if (!assignment?.isClassTeacher || assignment.grades.length === 0) {
    redirect("/teacher/attendance");
  }

  const { grades } = assignment;

  // Resolve active grade from ?grade= param
  const sp = await searchParams;
  const gradeParam = sp.grade;
  const activeGrade =
    gradeParam && grades.includes(gradeParam)
      ? gradeParam
      : grades.length === 1
        ? grades[0]!
        : null; // multi-grade, no selection yet

  // Show picker when teacher has multiple grades and none is selected
  if (!activeGrade) {
    return (
      <ClassGradeSelector
        grades={grades}
        currentPath="/teacher/class/attendance"
      />
    );
  }

  const students = await fetchClassStudents(activeGrade);
  const today = new Date().toISOString().split("T")[0]!;
  const studentIds = students.map((s) => s.id);

  const { data: todayAttendance } =
    studentIds.length > 0
      ? await supabase
          .from("attendance")
          .select("student_id, status, remarks")
          .in("student_id", studentIds)
          .eq("date", today)
      : { data: [] };

  const preFill: Record<string, { status: string; remarks: string }> = {};
  for (const r of (todayAttendance ?? []) as {
    student_id: string;
    status: string;
    remarks: string | null;
  }[]) {
    preFill[r.student_id] = { status: r.status, remarks: r.remarks ?? "" };
  }

  return (
    <ClassAttendanceClient
      teacherName={teacher.full_name}
      grade={activeGrade}
      grades={grades}
      students={students}
      todayDate={today}
      preFill={preFill}
    />
  );
}
