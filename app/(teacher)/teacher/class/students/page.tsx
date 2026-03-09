// app/teacher/class/students/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { fetchMyClassTeacherAssignment } from "@/lib/actions/class-teacher";
import { ClassStudentsClient } from "./ClassStudentsClient";
import { StudentWithStats } from "./types";

export const metadata = { title: "My Class | Kibali Teacher" };
export const revalidate = 0;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function ClassStudentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const assignment = await fetchMyClassTeacherAssignment();
  if (!assignment?.isClassTeacher || !assignment.grade) redirect("/teacher");

  const grade = assignment.grade; // now narrowed to string

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
    .eq("current_grade", grade)
    .order("full_name");

  const students = (rawStudents ?? []) as any[];
  const studentIds = students.map((s) => s.id as string);

  // ── Attendance ────────────────────────────────────────────────────────────
  const { data: attendanceRows } =
    studentIds.length > 0
      ? await supabaseAdmin
          .from("attendance")
          .select("student_id, status")
          .in("student_id", studentIds)
      : { data: [] };

  // ── Assessment counts ─────────────────────────────────────────────────────
  const { data: assessmentRows } =
    studentIds.length > 0
      ? await supabaseAdmin
          .from("assessments")
          .select("student_id")
          .in("student_id", studentIds)
          .not("score", "is", null)
      : { data: [] };

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const attMap = new Map<
    string,
    { present: number; absent: number; late: number }
  >();
  for (const r of (attendanceRows ?? []) as {
    student_id: string;
    status: string;
  }[]) {
    const cur = attMap.get(r.student_id) ?? { present: 0, absent: 0, late: 0 };
    if (r.status === "Present") cur.present++;
    else if (r.status === "Absent") cur.absent++;
    else if (r.status === "Late") cur.late++;
    attMap.set(r.student_id, cur);
  }

  const assessMap = new Map<string, number>();
  for (const r of (assessmentRows ?? []) as { student_id: string }[]) {
    assessMap.set(r.student_id, (assessMap.get(r.student_id) ?? 0) + 1);
  }

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
      grade={grade}
      academicYear={assignment.academicYear ?? 2026}
    />
  );
}
