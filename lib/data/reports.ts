// lib/data/reports.ts
// Data fetching for bulk report generation.
// Used by: app/api/reports/generate/route.ts

import { supabaseAdmin } from "../supabase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReportAssessment {
  subject_name: string;
  strand_id: string;
  score: "EE" | "ME" | "AE" | "BE" | null;
  teacher_remarks: string | null;
  teacher_name: string | null;
  term: number;
  academic_year: number;
}

export interface ReportStudent {
  full_name: string;
  readable_id: string | null;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  parent_name: string | null;
  parent_phone: string | null;
  assessments: ReportAssessment[];
  // Report card fields (class teacher remarks etc.)
  class_teacher_remarks: string | null;
  conduct_grade: string | null;
  effort_grade: string | null;
  attendance_present: number;
  attendance_absent: number;
  attendance_late: number;
  attendance_total: number;
}

export interface ReportGenerationPayload {
  students: ReportStudent[];
  term: number;
  academic_year: number;
  mode: "bulk" | "single";
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function fetchStudentsForReports(
  grade: string | null,
  term: number,
  academicYear: number,
): Promise<ReportStudent[]> {
  // 1. Students
  let studentQuery = supabaseAdmin
    .from("students")
    .select("id, full_name, readable_id, date_of_birth, gender, current_grade")
    .order("current_grade")
    .order("full_name");

  if (grade && grade !== "all") {
    studentQuery = studentQuery.eq("current_grade", grade);
  }

  const { data: students, error: studentsErr } = await studentQuery;
  if (studentsErr || !students || students.length === 0) {
    console.error("[fetchStudentsForReports] students:", studentsErr?.message);
    return [];
  }

  const studentIds = students.map((s: any) => s.id as string);

  // 2. Parent contacts via junction table (students.parent_id does not exist)
  const { data: parentLinks } = await supabaseAdmin
    .from("student_parents")
    .select(
      "student_id, is_primary_contact, parents ( full_name, phone_number )",
    )
    .in("student_id", studentIds);

  // 3. Assessments for this term
  const { data: assessments, error: assessErr } = await supabaseAdmin
    .from("assessments")
    .select(
      `
      student_id,
      subject_name,
      strand_id,
      score,
      teacher_remarks,
      term,
      academic_year,
      teachers ( full_name )
    `,
    )
    .in("student_id", studentIds)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .not("score", "is", null)
    .order("subject_name");

  if (assessErr)
    console.error("[fetchStudentsForReports] assessments:", assessErr.message);

  // 4. Report cards (class teacher remarks, conduct, effort)
  const { data: reportCards } = await supabaseAdmin
    .from("report_cards")
    .select(
      "student_id, class_teacher_remarks, conduct_grade, effort_grade, status",
    )
    .in("student_id", studentIds)
    .eq("term", term)
    .eq("academic_year", academicYear);

  // 5. Attendance (all records — no term date table yet)
  const { data: attendanceRows } = await supabaseAdmin
    .from("attendance")
    .select("student_id, status")
    .in("student_id", studentIds);

  // ── Aggregate helpers ─────────────────────────────────────────────────────

  // Parents map: studentId → primary parent
  const parentMap = new Map<
    string,
    { full_name: string; phone_number: string | null }
  >();
  for (const link of (parentLinks ?? []) as any[]) {
    const existing = parentMap.get(link.student_id);
    // Prefer primary contact; otherwise take first
    if (!existing || link.is_primary_contact) {
      const p = Array.isArray(link.parents) ? link.parents[0] : link.parents;
      if (p) parentMap.set(link.student_id, p);
    }
  }

  // Assessments map: studentId → ReportAssessment[]
  const assessMap = new Map<string, ReportAssessment[]>();
  for (const a of (assessments ?? []) as any[]) {
    const teacher = Array.isArray(a.teachers) ? a.teachers[0] : a.teachers;
    const entry: ReportAssessment = {
      subject_name: a.subject_name,
      strand_id: a.strand_id,
      score: a.score,
      teacher_remarks: a.teacher_remarks ?? null,
      teacher_name: teacher?.full_name ?? null,
      term: a.term,
      academic_year: a.academic_year,
    };
    const list = assessMap.get(a.student_id) ?? [];
    list.push(entry);
    assessMap.set(a.student_id, list);
  }

  // Report cards map: studentId → rc
  const rcMap = new Map<string, any>();
  for (const rc of (reportCards ?? []) as any[]) {
    rcMap.set(rc.student_id, rc);
  }

  // Attendance map: studentId → { present, absent, late }
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

  // ── Build result ──────────────────────────────────────────────────────────
  return (students as any[]).map((s): ReportStudent => {
    const parent = parentMap.get(s.id);
    const rc = rcMap.get(s.id) ?? null;
    const att = attMap.get(s.id) ?? { present: 0, absent: 0, late: 0 };

    return {
      full_name: s.full_name,
      readable_id: s.readable_id ?? null,
      date_of_birth: s.date_of_birth,
      gender: s.gender ?? null,
      current_grade: s.current_grade,
      parent_name: parent?.full_name ?? null,
      parent_phone: parent?.phone_number ?? null,
      assessments: assessMap.get(s.id) ?? [],
      class_teacher_remarks: rc?.class_teacher_remarks ?? null,
      conduct_grade: rc?.conduct_grade ?? null,
      effort_grade: rc?.effort_grade ?? null,
      attendance_present: att.present,
      attendance_absent: att.absent,
      attendance_late: att.late,
      attendance_total: att.present + att.absent + att.late,
    };
  });
}

// ── Grade list for filter dropdowns ──────────────────────────────────────────

export async function fetchAllGrades(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("current_grade");

  if (error) {
    console.error("[fetchAllGrades]", error.message);
    return [];
  }

  const grades = [
    ...new Set(
      (data ?? []).map((r: { current_grade: string }) => r.current_grade),
    ),
  ];

  const CBC_ORDER = [
    "PP1",
    "PP2",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7 / JSS 1",
    "Grade 8 / JSS 2",
    "Grade 9 / JSS 3",
    "Form 1",
    "Form 2",
    "Form 3",
    "Form 4",
  ];

  return grades.sort((a, b) => {
    const ai = CBC_ORDER.indexOf(a);
    const bi = CBC_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}
