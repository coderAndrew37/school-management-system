// app/teacher/class/reports/page.tsx

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ClassReportsClient } from "./ClassReportsClient";
import type { SubjectScore, CbcScore, StudentReport } from "./types";
import { ClassGradeSelector } from "@/app/(teacher)/_components/ClassGradeSelector";

export const metadata = { title: "Report Cards | Kibali Teacher" };
export const revalidate = 0;

const ACADEMIC_YEAR = 2026;

// ── Strict Structural Interfaces ─────────────────────────────────────────────

interface RawAssessmentRow {
  student_id: string;
  subject_name: string;
  strand_id: string;
  score: string | null;
  teacher_remarks: string | null;
  term: number;
}

interface RawReportCardRow {
  id: string;
  student_id: string;
  term: number;
  class_teacher_remarks: string | null;
  conduct_grade: string | null;
  effort_grade: string | null;
  status: string | null;
}

interface Props {
  searchParams: Promise<{ grade?: string }>;
}

export default async function ClassReportsPage({ searchParams }: Props) {
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

  // Check 'classes' property and verify it exists to satisfy TypeScript union types
  if (
    !assignment?.isClassTeacher ||
    !assignment.classes ||
    assignment.classes.length === 0
  ) {
    redirect("/teacher");
  }

  // Extract the string array of grades from the classes objects
  const grades = assignment.classes.map((c) => c.grade as string);

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
        currentPath="/teacher/class/reports"
      />
    );
  }

  // ── Fetch all data for the active grade ──────────────────────────────────
  const { data: rawStudents } = await supabaseAdmin
    .from("students")
    .select("id, full_name, readable_id, gender, date_of_birth, current_grade")
    .eq("current_grade", activeGrade)
    .eq("status", "active")
    .order("full_name");

  const students = (rawStudents ?? []) as {
    id: string;
    full_name: string;
    readable_id: string | null;
    gender: "Male" | "Female" | null;
    date_of_birth: string;
    current_grade: string;
  }[];

  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return (
      <ClassReportsClient
        students={[]}
        grade={activeGrade}
        grades={grades}
        academicYear={ACADEMIC_YEAR}
        classTeacherId={session.profile.id}
      />
    );
  }

  const [assessmentRows, attendanceRows, reportCards] = await Promise.all([
    supabaseAdmin
      .from("assessments")
      .select(
        "student_id, subject_name, strand_id, score, teacher_remarks, term",
      )
      .in("student_id", studentIds)
      .eq("academic_year", ACADEMIC_YEAR)
      .not("score", "is", null)
      .order("subject_name")
      .order("term"),

    supabaseAdmin
      .from("attendance")
      .select("student_id, status")
      .in("student_id", studentIds),

    supabaseAdmin
      .from("report_cards")
      .select(
        "id, student_id, term, class_teacher_remarks, conduct_grade, effort_grade, status",
      )
      .in("student_id", studentIds)
      .eq("academic_year", ACADEMIC_YEAR),
  ]);

  // Score deduplication — latest per (subject, strand)
  const scoresByStudent = new Map<string, SubjectScore[]>();
  const rawAssessments = (assessmentRows.data ?? []) as unknown as RawAssessmentRow[];

  for (const r of rawAssessments) {
    if (!r.score) continue;
    const list = scoresByStudent.get(r.student_id) ?? [];
    const idx = list.findIndex(
      (x) => x.subject_name === r.subject_name && x.strand_id === r.strand_id,
    );
    const entry: SubjectScore = {
      subject_name: r.subject_name,
      strand_id: r.strand_id,
      score: r.score as CbcScore,
      teacher_remarks: r.teacher_remarks ?? null,
      term: r.term,
    };
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    scoresByStudent.set(r.student_id, list);
  }

  const attMap = new Map<
    string,
    { present: number; absent: number; late: number }
  >();
  for (const r of (attendanceRows.data ?? []) as {
    student_id: string;
    status: string;
  }[]) {
    const cur = attMap.get(r.student_id) ?? { present: 0, absent: 0, late: 0 };
    if (r.status === "Present") cur.present++;
    else if (r.status === "Absent") cur.absent++;
    else if (r.status === "Late") cur.late++;
    attMap.set(r.student_id, cur);
  }

  const rcMap = new Map<string, RawReportCardRow>();
  const rawReportCards = (reportCards.data ?? []) as unknown as RawReportCardRow[];
  for (const rc of rawReportCards) {
    rcMap.set(rc.student_id, rc);
  }

  const enriched: StudentReport[] = students.map((s) => {
    const att = attMap.get(s.id) ?? { present: 0, absent: 0, late: 0 };
    const total = att.present + att.absent + att.late;
    const rc = rcMap.get(s.id) ?? null;

    // Type guard assertion for the specific string literal unions
    const reportStatus =
      rc?.status === "draft" || rc?.status === "published"
        ? rc.status
        : null;

    return {
      id: s.id,
      full_name: s.full_name,
      readable_id: s.readable_id ?? null,
      gender: s.gender ?? null,
      date_of_birth: s.date_of_birth ?? "",
      present: att.present,
      absent: att.absent,
      late: att.late,
      total_days: total,
      attendance_rate:
        total > 0 ? Math.round(((att.present + att.late) / total) * 100) : 0,
      scores: scoresByStudent.get(s.id) ?? [],
      report_card_id: rc?.id ?? null,
      class_teacher_remarks: rc?.class_teacher_remarks ?? null,
      conduct_grade: rc?.conduct_grade ?? null,
      effort_grade: rc?.effort_grade ?? null,
      status: reportStatus,
    };
  });

  return (
    <ClassReportsClient
      students={enriched}
      grade={activeGrade}
      grades={grades}
      academicYear={ACADEMIC_YEAR}
      classTeacherId={session.profile.id}
    />
  );
}