import { createServerClient } from "@/lib/supabase/client";
import type { Parent } from "@/lib/types/dashboard";
import type { Assessment, ChildWithAssessments } from "@/lib/types/parent";

// ── Internal Supabase response shapes ─────────────────────────────────────────
// These mirror exactly what Supabase returns for each query.
// We cast ONCE here so every consumer is fully typed.

type AssessmentRow = {
  id: string;
  student_id: string;
  teacher_id: string;
  subject_name: string;
  strand_id: string;
  score: "EE" | "ME" | "AE" | "BE" | null;
  evidence_url: string | null;
  teacher_remarks: string | null;
  term: number;
  academic_year: number;
  created_at: string;
};

type ParentRow = {
  full_name: string;
  phone_number: string;
};

type RawStudentRow = {
  id: string;
  readable_id: string | null;
  upi_number: string | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  parent_id: string | null;
  created_at: string;
  parents: ParentRow | null;
  assessments: AssessmentRow[];
};

// ── Mappers ────────────────────────────────────────────────────────────────────

function mapAssessment(row: AssessmentRow): Assessment {
  return {
    id: row.id,
    student_id: row.student_id,
    teacher_id: row.teacher_id,
    subject_name: row.subject_name,
    strand_id: row.strand_id,
    score: row.score,
    evidence_url: row.evidence_url,
    teacher_remarks: row.teacher_remarks,
    // The DB CHECK constraint ensures term is 1|2|3; we assert here.
    term: row.term as 1 | 2 | 3,
    academic_year: row.academic_year,
    created_at: row.created_at,
  };
}

function mapStudentRow(row: RawStudentRow): ChildWithAssessments {
  return {
    id: row.id,
    readable_id: row.readable_id,
    upi_number: row.upi_number,
    full_name: row.full_name,
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    current_grade: row.current_grade,
    parent_id: row.parent_id,
    created_at: row.created_at,
    parents: row.parents,
    assessments: row.assessments.map(mapAssessment),
  };
}

// ── Student select fragment ────────────────────────────────────────────────────

const STUDENT_WITH_ASSESSMENTS_SELECT = `
  id, readable_id, upi_number, full_name,
  date_of_birth, gender, current_grade,
  parent_id, created_at,
  parents ( full_name, phone_number ),
  assessments (
    id, student_id, teacher_id, subject_name,
    strand_id, score, evidence_url,
    teacher_remarks, term, academic_year, created_at
  )
` as const;

// ── Public API ────────────────────────────────────────────────────────────────

/** Fetch the parent record for the currently authenticated user. */
export async function fetchMyProfile(): Promise<Parent | null> {
  const supabase = createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.email) return null;

  const { data, error } = await supabase
    .from("parents")
    .select("id, full_name, email, phone_number, created_at")
    .eq("email", user.email)
    .single<Parent>();

  if (error) {
    console.error("fetchMyProfile error:", error);
    return null;
  }

  return data;
}

/** Fetch all children linked to this parent.
 *  RLS `current_parent_id()` scopes the query — no client-side filtering needed.
 */
export async function fetchMyChildren(): Promise<ChildWithAssessments[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_WITH_ASSESSMENTS_SELECT)
    .order("full_name", { ascending: true })
    .returns<RawStudentRow[]>();

  if (error) {
    console.error("fetchMyChildren error:", error);
    return [];
  }

  return (data ?? []).map(mapStudentRow);
}

/** Fetch a single child with assessments.
 *  RLS enforces ownership — if the child doesn't belong to this parent,
 *  Supabase returns null.
 */
export async function fetchChild(
  studentId: string,
): Promise<ChildWithAssessments | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_WITH_ASSESSMENTS_SELECT)
    .eq("id", studentId)
    .single<RawStudentRow>();

  if (error) {
    console.error("fetchChild error:", error);
    return null;
  }

  return data ? mapStudentRow(data) : null;
}
