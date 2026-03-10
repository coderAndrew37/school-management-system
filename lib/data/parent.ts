// lib/data/parent.ts
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
import { supabaseAdmin } from "../supabase/admin";

// NOTE: student_competencies table does not exist in the DB.
// TalentCompetency type is kept for future use; competencies always returns [].

// ── Re-export types that components import from this module ───────────────────
// These are defined in @/lib/types/parent but some components (e.g. the
// ParentAnnouncementsClient and MyChildTodayWidget) import them from
// "@/lib/data/parent" — re-exporting here keeps both paths working.
export type { AttendanceRecord, DiaryEntry } from "@/lib/types/parent";

// ── Exported aggregate types ──────────────────────────────────────────────────

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
  announcements: Announcement[];
  events: SchoolEvent[];
  feePayments: FeePayment[];
  unreadCount: number;
}

// ── Raw DB shape for talent_gallery ──────────────────────────────────────────
// Matches the ACTUAL column names in the DB schema:
//   tags         text[]   (NOT skills_tagged)
//   description text     (NOT caption-only — both exist)
//   media_url    text     (storage path)
//   image_url    text     (legacy public URL column — may be populated)
// NOTE: `captured_on` does NOT exist in the DB. Do not select it.

interface RawGalleryRow {
  id: string;
  student_id: string | null;
  target_grade: string | null;
  audience: string | null;
  teacher_id: string | null;
  title: string | null;
  caption: string | null;
  description: string | null;
  category: string | null;
  media_type: string | null;
  media_url: string; // storage path (NOT a usable URL)
  image_url: string | null; // legacy public URL — use as fallback
  tags: string[] | null;
  term: number | null;
  academic_year: number | null;
  created_at: string;
}

// ── GALLERY_SELECT — only columns that ACTUALLY exist in the DB ───────────────
const GALLERY_SELECT =
  "id, student_id, target_grade, audience, teacher_id, " +
  "title, caption, description, category, media_type, " +
  "media_url, image_url, tags, term, academic_year, created_at";

// ── Student query helpers ─────────────────────────────────────────────────────

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
    parents: { full_name: string; phone_number: string } | null;
  }[];
  assessments: AssessmentRow[];
};

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

function getPrimaryParent(links: RawStudentRow["student_parents"]) {
  const primary = links.find((l) => l.is_primary_contact) ?? links[0] ?? null;
  return primary?.parents ?? null;
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
    assessments: row.assessments.map(
      (r): Assessment => ({
        id: r.id,
        student_id: r.student_id,
        teacher_id: r.teacher_id,
        subject_name: r.subject_name,
        strand_id: r.strand_id,
        score: r.score,
        evidence_url: r.evidence_url,
        teacher_remarks: r.teacher_remarks,
        term: r.term as 1 | 2 | 3,
        academic_year: r.academic_year,
        created_at: r.created_at,
      }),
    ),
  };
}

// ── signGalleryUrl ────────────────────────────────────────────────────────────
async function signGalleryUrl(
  mediaUrl: string,
  imageUrl: string | null,
): Promise<string> {
  if (imageUrl && imageUrl.startsWith("http")) return imageUrl;
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("http")) return mediaUrl;

  const { data, error } = await supabaseAdmin.storage
    .from("gallery")
    .createSignedUrl(mediaUrl, 3600);

  if (error) {
    console.error(
      "[signGalleryUrl] failed:",
      error.message,
      "| path:",
      mediaUrl,
    );
    return "";
  }
  return data.signedUrl;
}

// ── mapGalleryRow ─────────────────────────────────────────────────────────────
async function mapGalleryRow(row: RawGalleryRow): Promise<GalleryItem> {
  const signedUrl = await signGalleryUrl(row.media_url, row.image_url);
  return {
    id: row.id,
    student_id: row.student_id ?? null,
    target_grade: row.target_grade ?? null,
    audience: (row.audience ?? "student") as GalleryItem["audience"],
    teacher_id: row.teacher_id ?? null,
    title: row.title ?? "Untitled",
    caption: row.caption ?? null,
    description: row.description ?? null,
    category: row.category ?? null,
    media_type: (row.media_type === "video"
      ? "video"
      : "image") as GalleryItem["media_type"],
    media_url: row.media_url,
    signedUrl,
    tags: Array.isArray(row.tags) ? row.tags : [],
    term: row.term ?? null,
    academic_year: row.academic_year ?? null,
    created_at: row.created_at,
  };
}

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

export async function fetchMyChildren(): Promise<ChildWithAssessments[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select(STUDENT_WITH_ASSESSMENTS_SELECT)
    .order("full_name", { ascending: true })
    .returns<RawStudentRow[]>();

  if (error) {
    console.error("[fetchMyChildren]", error.message, error.details);
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
    console.error("[fetchChild]", error.message);
    return null;
  }
  return data ? mapStudentRow(data) : null;
}

export async function fetchAllChildData(
  studentId: string,
  grade: string,
): Promise<ChildPortalData> {
  const supabase = await createSupabaseServerClient();
  const competencies: TalentCompetency[] = [];

  const [
    { data: notifications },
    { data: diary },
    { data: attendance },
    { data: messages },
    { data: galleryStudent, error: eGalStudent },
    { data: galleryClass, error: eGalClass },
    { data: gallerySchool, error: eGalSchool },
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

    // Gallery tier 1: child-specific
    supabase
      .from("talent_gallery")
      .select(GALLERY_SELECT)
      .eq("audience", "student")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60),

    // Gallery tier 2: class-wide
    supabase
      .from("talent_gallery")
      .select(GALLERY_SELECT)
      .eq("audience", "class")
      .eq("target_grade", grade)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40),

    // Gallery tier 3: school-wide
    supabase
      .from("talent_gallery")
      .select(GALLERY_SELECT)
      .eq("audience", "school")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),

    supabase
      .from("jss_pathways")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle(),

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

  if (eGalStudent)
    console.error(
      "[gallery/student]",
      eGalStudent.message,
      eGalStudent.details,
    );
  if (eGalClass)
    console.error("[gallery/class]", eGalClass.message, eGalClass.details);
  if (eGalSchool)
    console.error("[gallery/school]", eGalSchool.message, eGalSchool.details);

  // Merge gallery tiers, de-dupe by id
  const seenIds = new Set<string>();
  const rawGallery: RawGalleryRow[] = [];

  // FIX: Using 'unknown' intermediary to bypass TS2352 overlap error
  for (const row of [
    ...((galleryStudent ?? []) as unknown as RawGalleryRow[]),
    ...((galleryClass ?? []) as unknown as RawGalleryRow[]),
    ...((gallerySchool ?? []) as unknown as RawGalleryRow[]),
  ]) {
    if (row && typeof row === "object" && "id" in row && !seenIds.has(row.id)) {
      seenIds.add(row.id);
      rawGallery.push(row);
    }
  }

  const gallery: GalleryItem[] = await Promise.all(
    rawGallery.map(mapGalleryRow),
  );

  const unreadCount =
    (notifications?.filter((n) => !n.is_read).length ?? 0) +
    (messages?.filter((m) => !m.is_read && m.sender_role !== "parent").length ??
      0);

  return {
    notifications: notifications ?? [],
    diary: diary ?? [],
    attendance: attendance ?? [],
    messages: messages ?? [],
    competencies,
    gallery,
    pathway: pathway ?? null,
    announcements: announcements ?? [],
    events: events ?? [],
    feePayments: feePayments ?? [],
    unreadCount,
  };
}
