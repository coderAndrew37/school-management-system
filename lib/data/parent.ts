import { createSupabaseServerClient } from "@/lib/supabase/server";
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

// These are fetched school-wide (not per-student) but included in ChildPortalData
// so ParentPortalHub receives everything in one prop.
export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  target_grade: string | null;
  priority: string;
  expires_at: string | null;
  created_at: string;
};

export type SchoolEvent = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  audience: string;
  target_grade: string | null;
  created_at: string;
};

export type FeePayment = {
  id: string;
  student_id: string;
  amount: number;
  status: string;
  term: number;
  academic_year: number;
  paid_at: string | null;
  created_at: string;
};

export interface ChildPortalData {
  notifications: StudentNotification[];
  diary: DiaryEntry[];
  attendance: AttendanceRecord[];
  messages: CommMessage[];
  competencies: TalentCompetency[];
  gallery: GalleryItem[];
  pathway: JssPathway | null;
  // School-wide data filtered/used by ParentPortalHub
  announcements: Announcement[];
  events: SchoolEvent[];
  feePayments: FeePayment[];
  unreadCount: number;
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

type RawStudentRow = {
  id: string;
  readable_id: string | null;
  upi_number: string | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  created_at: string;
  student_parents: {
    is_primary_contact: boolean;
    relationship_type: string;
    parents: ParentRow | null;
  }[];
  assessments: AssessmentRow[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    parent_id: null,
    created_at: row.created_at,
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

export async function fetchMyProfile(): Promise<Parent | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data, error } = await supabase
    .from("parents")
    .select("id, full_name, email, phone_number, created_at")
    .eq("id", user.id)
    .single<Parent>();

  if (error) {
    // Fallback: match by email in case id diverged
    const { data: byEmail, error: emailErr } = await supabase
      .from("parents")
      .select("id, full_name, email, phone_number, created_at")
      .eq("email", user.email ?? "")
      .single<Parent>();

    if (emailErr) {
      console.error("[fetchMyProfile] both lookups failed:", emailErr.message);
      return null;
    }
    return byEmail;
  }

  return data;
}

/**
 * Fetch all children linked to this parent via student_parents.
 * RLS `current_parent_id()` scopes the query — returns only this parent's children.
 */
export async function fetchMyChildren(): Promise<ChildWithAssessments[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_WITH_ASSESSMENTS_SELECT)
    .order("full_name", { ascending: true })
    .returns<RawStudentRow[]>();

  if (error) {
    console.error("[fetchMyChildren] error:", error.message, error.details);
    return [];
  }

  return (data ?? []).map(mapStudentRow);
}

export async function fetchChild(
  studentId: string,
): Promise<ChildWithAssessments | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_WITH_ASSESSMENTS_SELECT)
    .eq("id", studentId)
    .single<RawStudentRow>();

  if (error) {
    console.error("[fetchChild] error:", error.message);
    return null;
  }

  return data ? mapStudentRow(data) : null;
}

/**
 * Aggregates all data needed for the Parent Portal Hub view.
 * Runs all queries in parallel for performance.
 */
export async function fetchAllChildData(
  studentId: string,
  grade: string,
): Promise<ChildPortalData> {
  const supabase = await createSupabaseServerClient();

  const [
    { data: notifications },
    { data: diary },
    { data: attendance },
    { data: messages },
    { data: competencies },
    { data: gallery },
    { data: pathway },
    { data: announcements },
    { data: events },
    { data: feePayments },
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

    // School-wide — no student filter, RLS handles audience scoping
    supabase
      .from("announcements")
      .select(
        "id, title, body, audience, target_grade, priority, expires_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("school_events")
      .select(
        "id, title, description, start_date, end_date, audience, target_grade, created_at",
      )
      .gte(
        "start_date",
        new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
      )
      .order("start_date", { ascending: true })
      .limit(30),

    supabase
      .from("fee_payments")
      .select(
        "id, student_id, amount, status, term, academic_year, paid_at, created_at",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),
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
    announcements: announcements ?? [],
    events: events ?? [],
    feePayments: feePayments ?? [],
    unreadCount: unreadNotifs + unreadMessages,
  };
}
