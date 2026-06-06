// app/teacher/class/students/page.tsx

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ClassStudentsClient } from "./ClassStudentsClient";
import type { StudentWithStats } from "./types";
import { ClassGradeSelector } from "@/app/(teacher)/_components/ClassGradeSelector";

export const metadata = { title: "My Class | Kibali Teacher" };
export const revalidate = 0;

// ── Strict Structural Interfaces ─────────────────────────────────────────────

interface ParentRecord {
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
}

interface StudentParentLink {
  is_primary_contact: boolean;
  profiles: ParentRecord | null;
}

interface RawStudentJoined {
  id: string;
  full_name: string;
  readable_id: string | null;
  upi_number: string | null;
  gender: "Female" | "Male" | string | null; 
  date_of_birth: string | null;
  current_grade: string;
  student_parents: StudentParentLink[] | StudentParentLink | null;
}

interface Props {
  searchParams: Promise<{ grade?: string }>;
}

export default async function ClassStudentsPage({ searchParams }: Props) {
  // ── Access Control Guard ───────────────────────────────────────────────────
  const session = await getSession();
  if (!session || !session.profile) {
    redirect("/login");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect route with structural check for staff (teachers) and administrator overrides
  if (base_role !== "staff" && base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  const assignment = await fetchMyClassTeacherAssignments();

  // Check 'classes' property instead of 'grades' to satisfy TypeScript union types
  if (
    !assignment?.isClassTeacher ||
    !assignment.classes ||
    assignment.classes.length === 0
  ) {
    redirect("/teacher");
  }

  // Extract the string array of grades for compatibility with the rest of the file
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
        profiles!student_parents_parent_id_profiles_fkey ( full_name, phone_number, email )
      )
    `,
  )
    .eq("current_grade", activeGrade)
    .eq("status", "active")
    .order("full_name");

  const students = (rawStudents ?? []) as unknown as RawStudentJoined[];
  const studentIds = students.map((s) => s.id);

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
  for (const r of assessmentRows as { student_id: string }[]) {
    assessMap.set(r.student_id, (assessMap.get(r.student_id) ?? 0) + 1);
  }

  const enriched: StudentWithStats[] = students.map((s) => {
    const att = attMap.get(s.id) ?? { present: 0, absent: 0, late: 0 };
    const total = att.present + att.absent + att.late;
    const rate =
      total > 0 ? Math.round(((att.present + att.late) / total) * 100) : 0;

    const links: StudentParentLink[] = Array.isArray(s.student_parents)
      ? s.student_parents
      : s.student_parents
        ? [s.student_parents]
        : [];

    const primary =
      links.find((l) => l.is_primary_contact) ?? links[0] ?? null;
    const parent = primary?.profiles ?? null;

    // Type guard assertion matching the exact 'StudentWithStats' literal type requirements
    const studentGender =
      s.gender === "Female" || s.gender === "Male" ? s.gender : null;

    return {
      id: s.id,
      full_name: s.full_name,
      readable_id: s.readable_id ?? null,
      upi_number: s.upi_number ?? null,
      gender: studentGender,
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