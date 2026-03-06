import { createServerClient } from "@/lib/supabase/client";
import type { Parent } from "@/lib/types/dashboard";
import type {
  Assessment,
  AttendanceRecord,
  ChildWithAssessments,
  CommMessage,
  DiaryEntry,
  GalleryItem,
  JssPathway,
  StudentNotification,
  TalentCompetency,
} from "@/lib/types/parent";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChildPortalData {
  notifications: StudentNotification[];
  diary: DiaryEntry[];
  attendance: AttendanceRecord[];
  messages: CommMessage[];
  competencies: TalentCompetency[];
  gallery: GalleryItem[];
  pathway: JssPathway | null;
}

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

// parent_id removed — relationship now lives in student_parents
type RawStudentRow = {
  id: string;
  readable_id: string | null;
  upi_number: string | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  created_at: string;
  // join table rows, each nesting the parent object
  student_parents: {
    is_primary_contact: boolean;
    relationship_type: string;
    parents: ParentRow | null;
  }[];
  assessments: AssessmentRow[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick the primary contact parent, falling back to the first linked parent. */
function getPrimaryParent(
  links: RawStudentRow["student_parents"],
): ParentRow | null {
  const primary = links.find((l) => l.is_primary_contact) ?? links[0] ?? null;
  return primary?.parents ?? null;
}

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
    // parent_id is no longer on the students table — consumers should use
    // `parents` below instead.
    parent_id: null,
    created_at: row.created_at,
    // Flatten to the same shape as before so all existing UI components
    // that read child.parents.full_name continue to work unchanged.
    parents: getPrimaryParent(row.student_parents),
    assessments: row.assessments.map(mapAssessment),
  };
}

// ── Select fragment ───────────────────────────────────────────────────────────

const STUDENT_WITH_ASSESSMENTS_SELECT = `
  id, readable_id, upi_number, full_name,
  date_of_birth, gender, current_grade, created_at,
  student_parents (
    is_primary_contact,
    relationship_type,
    parents ( full_name, phone_number )
  ),
  assessments (
    id, student_id, teacher_id, subject_name,
    strand_id, score, evidence_url,
    teacher_remarks, term, academic_year, created_at
  )
` as const;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the parent record for the currently authenticated user.
 * Looks up by auth.uid() via profiles, not by email, for reliability.
 */
export async function fetchMyProfile(): Promise<Parent | null> {
  const supabase = createServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  // Look up via profiles → parents join using auth uid, not email
  const { data, error } = await supabase
    .from("parents")
    .select("id, full_name, email, phone_number, created_at")
    .eq("id", user.id)
    .single<Parent>();

  if (error) {
    // Fallback: try by email in case the parent's id differs from auth uid
    const { data: byEmail, error: emailErr } = await supabase
      .from("parents")
      .select("id, full_name, email, phone_number, created_at")
      .eq("email", user.email ?? "")
      .single<Parent>();

    if (emailErr) {
      console.error("fetchMyProfile error:", emailErr);
      return null;
    }
    return byEmail;
  }

  return data;
}

/**
 * Fetch all children linked to this parent via student_parents.
 * RLS `current_parent_id()` scopes the query — no client-side filtering needed.
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

/**
 * Fetch a single child with assessments.
 * RLS enforces ownership — returns null if not this parent's child.
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

/**
 * Aggregates all data required for the Parent Portal Hub view.
 */
export async function fetchAllChildData(
  studentId: string,
  grade: string,
): Promise<ChildPortalData & { unreadCount: number }> {
  const supabase = createServerClient();

  const [
    { data: notifications },
    { data: diary },
    { data: attendance },
    { data: messages },
    { data: competencies },
    { data: gallery },
    { data: pathway },
  ] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_diary")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("attendance")
      .select("*")
      .eq("student_id", studentId)
      .order("date", { ascending: false }),
    supabase
      .from("communication_book")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase.from("talent_gallery").select("*").eq("student_id", studentId),
    supabase
      .from("talent_gallery")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
    supabase
      .from("jss_pathways")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);

  const unreadNotifs = notifications?.filter((n) => !n.is_read).length ?? 0;
  const unreadMessages =
    messages?.filter((m) => !m.is_read && m.sender_role !== "parent").length ??
    0;

  return {
    notifications: notifications ?? [],
    diary: diary ?? [],
    attendance: attendance ?? [],
    messages: messages ?? [],
    competencies: competencies ?? [],
    gallery: gallery ?? [],
    pathway: pathway ?? null,
    unreadCount: unreadNotifs + unreadMessages,
  };
}
