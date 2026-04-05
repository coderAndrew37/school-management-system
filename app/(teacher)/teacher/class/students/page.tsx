import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ClassStudentsClient } from "./ClassStudentsClient";
import type { StudentWithStats } from "./types";
import { ClassGradeSelector } from "@/app/(teacher)/_components/ClassGradeSelector";

export const metadata = { title: "My Class | Kibali Teacher" };
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ grade?: string }>;
}

export default async function ClassStudentsPage({ searchParams }: Props) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const assignment = await fetchMyClassTeacherAssignments();

  // FIX: Check 'classes' property instead of 'grades' to satisfy TypeScript union types
  if (
    !assignment?.isClassTeacher ||
    !assignment.classes ||
    assignment.classes.length === 0
  ) {
    redirect("/teacher");
  }

  // FIX: Extract the string array of grades for compatibility with the rest of the file
  const grades = assignment.classes.map((c) => c.grade as string);

  // Grade resolution
  const sp = await searchParams;
  const gradeParam = sp.grade;
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
        currentPath="/teacher/class/students"
      />
    );
  }

  // ── Students ──────────────────────────────────────────────────────────────
  const { data: rawStudents } = await supabaseAdmin
    .from("students")
    .select(
      `
      id, full_name, readable_id, upi_number,
      gender, date_of_birth, current_grade,
      student_parents (
        is_primary_contact,
        parents ( full_name, phone_number, email )
      )
    `,
    )
    .eq("current_grade", activeGrade)
    .eq("status", "active")
    .order("full_name");

  const students = (rawStudents ?? []) as any[];
  const studentIds = students.map((s) => s.id as string);

  // ── Attendance + assessments (parallel) ──────────────────────────────────
  const [attendanceRows, assessmentRows] = await Promise.all([
    studentIds.length > 0
      ? supabaseAdmin
          .from("attendance")
          .select("student_id, status")
          .in("student_id", studentIds)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),

    studentIds.length > 0
      ? supabaseAdmin
          .from("assessments")
          .select("student_id")
          .in("student_id", studentIds)
          .not("score", "is", null)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const attMap = new Map<
    string,
    { present: number; absent: number; late: number }
  >();
  for (const r of attendanceRows as { student_id: string; status: string }[]) {
    const cur = attMap.get(r.student_id) ?? { present: 0, absent: 0, late: 0 };
    if (r.status === "Present") cur.present++;
    else if (r.status === "Absent") cur.absent++;
    else if (r.status === "Late") cur.late++;
    attMap.set(r.student_id, cur);
  }

  const assessMap = new Map<string, number>();
  for (const r of assessmentRows as { student_id: string }[])
    assessMap.set(r.student_id, (assessMap.get(r.student_id) ?? 0) + 1);

  const enriched: StudentWithStats[] = students.map((s) => {
    const att = attMap.get(s.id) ?? { present: 0, absent: 0, late: 0 };
    const total = att.present + att.absent + att.late;
    const rate =
      total > 0 ? Math.round(((att.present + att.late) / total) * 100) : 0;

    const links: any[] = Array.isArray(s.student_parents)
      ? s.student_parents
      : [];
    const primary =
      links.find((l: any) => l.is_primary_contact) ?? links[0] ?? null;
    const parent = primary?.parents ?? null;

    return {
      id: s.id,
      full_name: s.full_name,
      readable_id: s.readable_id ?? null,
      upi_number: s.upi_number ?? null,
      gender: s.gender ?? null,
      date_of_birth: s.date_of_birth ?? "",
      current_grade: s.current_grade,
      present: att.present,
      absent: att.absent,
      late: att.late,
      total_days: total,
      attendance_rate: rate,
      assessment_count: assessMap.get(s.id) ?? 0,
      parent_name: parent?.full_name ?? null,
      parent_phone: parent?.phone_number ?? null,
      parent_email: parent?.email ?? null,
    };
  });

  return (
    <ClassStudentsClient
      students={enriched}
      grade={activeGrade}
      grades={grades}
      academicYear={assignment.academicYear ?? 2026}
    />
  );
}
