// lib/data/reports.ts
// Data fetching for bulk report generation.
// Used by: app/api/reports/generate/route.ts

import { supabaseAdmin } from "../supabase/admin";

// ── 1. Row Interfaces ─────────────────────────────────────────────────────────

interface RawStudentRow {
  id: string;
  full_name: string;
  readable_id: string | null;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  class_id: string | null;
}

interface RawParentLink {
  student_id: string;
  is_primary_contact: boolean;
  parents: {
    full_name: string;
    phone_number: string | null;
  } | null;
}

interface RawAssessmentRow {
  student_id: string;
  subject_name: string;
  strand_id: string;
  score: "EE" | "ME" | "AE" | "BE" | null;
  teacher_remarks: string | null;
  term: number;
  academic_year: number;
  teachers: { full_name: string } | null;
}

interface RawReportCardRow {
  student_id: string;
  class_teacher_remarks: string | null;
  conduct_grade: string | null;
  effort_grade: string | null;
  status: string;
}

interface RawAttendanceRow {
  student_id: string;
  status: string;
}

// ── 2. Domain Types ───────────────────────────────────────────────────────────

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
  class_teacher_remarks: string | null;
  conduct_grade: string | null;
  effort_grade: string | null;
  attendance_present: number;
  attendance_absent: number;
  attendance_late: number;
  attendance_total: number;
}

// ── 3. Main fetch ──────────────────────────────────────────────────────────────

export async function fetchStudentsForReports(
  classId: string | null, // Refactored to use classId instead of grade string
  term: number,
  academicYear: number,
): Promise<ReportStudent[]> {
  // 1. Fetch Students based on the specific Class/Stream
  let studentQuery = supabaseAdmin
    .from("students")
    .select("id, full_name, readable_id, date_of_birth, gender, current_grade, class_id")
    .order("full_name");

  if (classId && classId !== "all") {
    studentQuery = studentQuery.eq("class_id", classId);
  }

  const { data: students, error: studentsErr } = await studentQuery.returns<RawStudentRow[]>();
  
  if (studentsErr || !students || students.length === 0) {
    console.error("[fetchStudentsForReports] students:", studentsErr?.message);
    return [];
  }

  const studentIds = students.map((s) => s.id);

  // 2. Parallel fetch for all related report data
  const [parentRes, assessRes, cardRes, attRes] = await Promise.all([
    supabaseAdmin
      .from("student_parents")
      .select("student_id, is_primary_contact, parents ( full_name, phone_number )")
      .in("student_id", studentIds)
      .returns<RawParentLink[]>(),

    supabaseAdmin
      .from("assessments")
      .select("student_id, subject_name, strand_id, score, teacher_remarks, term, academic_year, teachers ( full_name )")
      .in("student_id", studentIds)
      .eq("term", term)
      .eq("academic_year", academicYear)
      .not("score", "is", null)
      .order("subject_name")
      .returns<RawAssessmentRow[]>(),

    supabaseAdmin
      .from("report_cards")
      .select("student_id, class_teacher_remarks, conduct_grade, effort_grade, status")
      .in("student_id", studentIds)
      .eq("term", term)
      .eq("academic_year", academicYear)
      .returns<RawReportCardRow[]>(),

    supabaseAdmin
      .from("attendance")
      .select("student_id, status")
      .in("student_id", studentIds)
      .returns<RawAttendanceRow[]>(),
  ]);

  // ── 4. Map and Aggregate Data ────────────────────────────────────────────────

  // Parents map: studentId → primary parent
  const parentMap = new Map<string, { full_name: string; phone_number: string | null }>();
  for (const link of (parentRes.data ?? [])) {
    const existing = parentMap.get(link.student_id);
    if (!existing || link.is_primary_contact) {
      if (link.parents) parentMap.set(link.student_id, link.parents);
    }
  }

  // Assessments map: studentId → ReportAssessment[]
  const assessMap = new Map<string, ReportAssessment[]>();
  for (const a of (assessRes.data ?? [])) {
    const entry: ReportAssessment = {
      subject_name: a.subject_name,
      strand_id: a.strand_id,
      score: a.score,
      teacher_remarks: a.teacher_remarks,
      teacher_name: a.teachers?.full_name ?? null,
      term: a.term,
      academic_year: a.academic_year,
    };
    const list = assessMap.get(a.student_id) ?? [];
    list.push(entry);
    assessMap.set(a.student_id, list);
  }

  // Report cards map
  const rcMap = new Map<string, RawReportCardRow>();
  for (const rc of (cardRes.data ?? [])) {
    rcMap.set(rc.student_id, rc);
  }

  // Attendance map
  const attMap = new Map<string, { present: number; absent: number; late: number }>();
  for (const r of (attRes.data ?? [])) {
    const cur = attMap.get(r.student_id) ?? { present: 0, absent: 0, late: 0 };
    if (r.status === "Present") cur.present++;
    else if (r.status === "Absent") cur.absent++;
    else if (r.status === "Late") cur.late++;
    attMap.set(r.student_id, cur);
  }

  // ── 5. Build Resulting Objects ──────────────────────────────────────────────

  return students.map((s): ReportStudent => {
    const parent = parentMap.get(s.id);
    const rc = rcMap.get(s.id);
    const att = attMap.get(s.id) ?? { present: 0, absent: 0, late: 0 };

    return {
      full_name: s.full_name,
      readable_id: s.readable_id,
      date_of_birth: s.date_of_birth,
      gender: s.gender,
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

// ── 4. Refactored Grades List (fetches from 'classes' table) ───────────────────

export interface ClassListOption {
  id: string;
  label: string;
}

export async function fetchReportClassOptions(academicYear: number): Promise<ClassListOption[]> {
  const { data, error } = await supabaseAdmin
    .from("classes")
    .select("id, grade, stream")
    .eq("academic_year", academicYear)
    .order("grade");

  if (error) {
    console.error("[fetchReportClassOptions]", error.message);
    return [];
  }

  return (data ?? []).map((c) => ({
    id: c.id,
    label: c.stream && c.stream !== "Main" ? `${c.grade} — ${c.stream}` : c.grade,
  }));
}