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
import type {
  Announcement,
  SchoolEvent,
  FeePayment,
} from "@/lib/types/governance";

export type { AttendanceRecord, DiaryEntry } from "@/lib/types/parent";

// ── Published report card as seen by a parent ─────────────────────────────────

export type ParentReportCard = {
  id: string;
  term: number;
  academic_year: number;
  status: "draft" | "published";
  class_teacher_remarks: string | null;
  conduct_grade: string | null;
  effort_grade: string | null;
  published_at: string | null;
};

// ── Aggregate portal data for one child ───────────────────────────────────────

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
  reportCards: ParentReportCard[];
  unreadCount: number;
}

// ── Raw DB shapes ─────────────────────────────────────────────────────────────

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
  media_url: string;
  image_url: string | null;
  tags: string[] | null;
  term: number | null;
  academic_year: number | null;
  created_at: string;
}

const GALLERY_SELECT =
  "id, student_id, target_grade, audience, teacher_id, " +
  "title, caption, description, category, media_type, " +
  "media_url, image_url, tags, term, academic_year, created_at";

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
  photo_url: string | null;
  status: string;
  created_at: string;
  student_parents: {
    is_primary_contact: boolean;
    relationship_type: string;
    parents: { id: string; full_name: string; phone_number: string } | null;
  }[];
  assessments: AssessmentRow[];
};

const STUDENT_WITH_ASSESSMENTS_SELECT = `
  id, readable_id, upi_number, full_name,
  date_of_birth, gender, current_grade, photo_url, status, created_at,
  student_parents (
    is_primary_contact, relationship_type,
    parents ( id, full_name, phone_number )
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
    photo_url: row.photo_url ?? null,
    status: (row.status ?? "active") as
      | "active"
      | "transferred"
      | "graduated"
      | "withdrawn",
    all_parents: [], // not needed in parent portal — primary contact is sufficient
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
    console.error("[signGalleryUrl]", error.message);
    return "";
  }
  return data.signedUrl;
}

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
    if (emailErr) return null;
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
  if (error) return [];
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
  if (error) return null;
  return data ? mapStudentRow(data) : null;
}

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
    { data: galleryStudent },
    { data: galleryClass },
    { data: gallerySchool },
    { data: pathway },
    { data: announcements },
    { data: events },
    { data: feePayments },
    { data: reportCards },
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

    // Gallery — three-tier fetch
    supabase
      .from("talent_gallery")
      .select(GALLERY_SELECT)
      .eq("audience", "student")
      .eq("student_id", studentId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60),

    supabase
      .from("talent_gallery")
      .select(GALLERY_SELECT)
      .eq("audience", "class")
      .eq("target_grade", grade)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40),

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
        "id, title, body, audience, target_grade, priority, pinned, published_at, expires_at, author_id, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),

    supabase
      .from("school_events")
      .select(
        "id, title, description, category, start_date, end_date, start_time, end_time, location, target_grades, is_public, author_id, created_at, updated_at",
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
        "id, student_id, fee_structure_id, term, academic_year, amount_due, amount_paid, status, payment_method, mpesa_code, paid_at, notes, recorded_by, created_at, updated_at, payment_date, reference_number",
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false }),

    // Published report cards — parents only see published ones
    supabase
      .from("report_cards")
      .select(
        "id, term, academic_year, status, class_teacher_remarks, conduct_grade, effort_grade, published_at",
      )
      .eq("student_id", studentId)
      .eq("status", "published")
      .order("academic_year", { ascending: false })
      .order("term", { ascending: false }),
  ]);

  // Gallery merging + dedup
  const seenIds = new Set<string>();
  const rawGallery: RawGalleryRow[] = [];
  for (const row of [
    ...(galleryStudent ?? []),
    ...(galleryClass ?? []),
    ...(gallerySchool ?? []),
  ] as unknown as RawGalleryRow[]) {
    if (row?.id && !seenIds.has(row.id)) {
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
    competencies: [],
    gallery,
    pathway: pathway ?? null,
    announcements: (announcements as unknown as Announcement[]) ?? [],
    events: (events as unknown as SchoolEvent[]) ?? [],
    feePayments: (feePayments as unknown as FeePayment[]) ?? [],
    reportCards: (reportCards ?? []) as ParentReportCard[],
    unreadCount,
  };
}
