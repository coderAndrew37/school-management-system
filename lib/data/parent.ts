import { supabaseAdmin } from "../supabase/admin";
import type { Parent, StudentParentLink } from "@/lib/types/dashboard";
import type {
  Assessment,
  AttendanceRecord,
  ChildWithAssessments,
  CommMessage,
  GalleryItem,
  JssPathway,
  StudentNotification,
  TalentCompetency,
} from "@/lib/types/parent";
import type {
  Announcement,
  SchoolEvent,
  FeePayment,
} from "@/lib/types/governance";

import {
  TeacherDiaryEntry,
  ClassDiaryEntry,
  ObservationEntry,
} from "../types/diary";

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
  diary: TeacherDiaryEntry[];
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

// ── Raw DB shapes (Strict Interfaces) ─────────────────────────────────────────

interface RawProfileJoin {
  full_name: string | null;
}

interface RawDiaryRow {
  id: string;
  entry_type: "homework" | "notice" | "observation";
  class_id: string | null;
  student_id: string | null;
  title: string;
  content: string | null;
  subject_name: string | null;
  due_date: string | null;
  is_completed: boolean | null;
  created_at: string;
  profiles: RawProfileJoin | null;
}

interface RawGalleryRow {
  id: string;
  student_id: string | null;
  target_grade: string | null;
  audience: "student" | "class" | "school" | null;
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
  current_stream: string;
  photo_url: string | null;
  status: string;
  created_at: string;
  student_parents: {
    is_primary_contact: boolean;
    relationship_type: string;
    parents: {
      id: string;
      full_name: string;
      phone_number: string | null;
      email: string;
      invite_accepted: boolean;
    } | null;
  }[];
  assessments: AssessmentRow[];
};

const STUDENT_WITH_ASSESSMENTS_SELECT = `
  id, readable_id, upi_number, full_name,
  date_of_birth, gender, current_grade, current_stream, photo_url, status, created_at,
  student_parents (
    is_primary_contact, relationship_type,
    parents ( id, full_name, phone_number, email, invite_accepted )
  ),
  assessments (
    id, student_id, teacher_id, subject_name,
    strand_id, score, evidence_url,
    teacher_remarks, term, academic_year, created_at
  )
` as const;

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapStudentRow(row: RawStudentRow): ChildWithAssessments {
  const primaryParentLink = row.student_parents.find((l) => l.is_primary_contact) ?? row.student_parents[0] ?? null;
  const primaryParent = primaryParentLink?.parents ?? null;

  const allParents: StudentParentLink[] = row.student_parents
    .filter((link) => link.parents !== null)
    .map((link) => ({
      parent_id: link.parents!.id,
      full_name: link.parents!.full_name,
      phone_number: link.parents!.phone_number,
      email: link.parents!.email,
      relationship_type: link.relationship_type,
      is_primary_contact: link.is_primary_contact,
      invite_accepted: link.parents!.invite_accepted,
    }));

  return {
    id: row.id,
    readable_id: row.readable_id,
    upi_number: row.upi_number,
    full_name: row.full_name,
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    class_id: null,
    current_grade: row.current_grade,
    current_stream: row.current_stream || "Main",
    grade_label: row.current_grade,
    parent_id: primaryParent?.id ?? null,
    created_at: row.created_at,
    photo_url: row.photo_url ?? null,
    status: (row.status ?? "active") as ChildWithAssessments["status"],
    all_parents: allParents,
    parents: primaryParent
      ? {
          id: primaryParent.id,
          full_name: primaryParent.full_name,
          phone_number: primaryParent.phone_number,
        }
      : null,
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

async function signGalleryUrl(mediaUrl: string, imageUrl: string | null): Promise<string> {
  if (imageUrl && imageUrl.startsWith("http")) return imageUrl;
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("http")) return mediaUrl;
  const { data, error } = await supabaseAdmin.storage.from("gallery").createSignedUrl(mediaUrl, 3600);
  if (error) return "";
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
    media_type: (row.media_type === "video" ? "video" : "image") as GalleryItem["media_type"],
    media_url: row.media_url,
    signedUrl,
    tags: Array.isArray(row.tags) ? row.tags : [],
    term: row.term ?? null,
    academic_year: row.academic_year ?? null,
    created_at: row.created_at,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchMyProfile(email: string): Promise<Parent | null> {
  const { data, error } = await supabaseAdmin
    .from("parents")
    .select("*, children:students(id, full_name, current_grade, status, photo_url)")
    .eq("email", email)
    .single();

  if (error) return null;
  return data as Parent;
}

export async function fetchMyChildren(): Promise<ChildWithAssessments[]> {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select(STUDENT_WITH_ASSESSMENTS_SELECT)
    .order("full_name", { ascending: true });

  if (error || !data) return [];
  return (data as unknown as RawStudentRow[]).map(mapStudentRow);
}

export async function fetchParentDiaryFeed(
  childId: string,
  classId: string,
  limit = 40,
): Promise<TeacherDiaryEntry[]> {
  const [classRes, obsRes] = await Promise.all([
    supabaseAdmin
      .from("student_diary")
      .select(`
        id, entry_type, class_id, title, content, due_date, is_completed, created_at, subject_name,
        profiles ( full_name )
      `)
      .eq("class_id", classId)
      .in("entry_type", ["homework", "notice"])
      .is("student_id", null)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<RawDiaryRow[]>(),
    supabaseAdmin
      .from("student_diary")
      .select(`
        id, entry_type, student_id, title, content, created_at, subject_name,
        profiles ( full_name )
      `)
      .eq("student_id", childId)
      .eq("entry_type", "observation")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<RawDiaryRow[]>(),
  ]);

  const classResult: ClassDiaryEntry[] = (classRes.data ?? []).map((r) => ({
    id: r.id,
    entry_type: r.entry_type as "homework" | "notice",
    class_id: r.class_id ?? "",
    title: r.title,
    content: r.content,
    subject_name: r.subject_name,
    diary_date: r.created_at.slice(0, 10),
    due_date: r.due_date,
    student_id: null,
    is_completed: !!r.is_completed,
    created_at: r.created_at,
    updated_at: r.created_at,
    profiles: r.profiles,
  }));

  const obsResult: ObservationEntry[] = (obsRes.data ?? []).map((r) => ({
    id: r.id,
    entry_type: "observation" as const,
    class_id: null,
    student_id: r.student_id ?? "",
    title: r.title,
    content: r.content,
    subject_name: r.subject_name,
    diary_date: r.created_at.slice(0, 10),
    due_date: null,
    is_completed: false,
    created_at: r.created_at,
    updated_at: r.created_at,
    profiles: r.profiles,
  }));

  return [...classResult, ...obsResult].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function fetchAllChildData(
  studentId: string,
  classId: string,
  gradeLabel: string,
): Promise<ChildPortalData> {
  const [
    { data: notifications },
    diary,
    { data: attendance },
    { data: messages },
    { data: galleryStudent },
    { data: galleryClass },
    { data: gallerySchool },
    { data: pathwayResult }, // Destructure the full result object
    { data: announcements },
    { data: events },
    { data: feePayments },
    { data: reportCards },
  ] = await Promise.all([
    supabaseAdmin.from("notifications").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).returns<StudentNotification[]>(),
    fetchParentDiaryFeed(studentId, classId),
    supabaseAdmin.from("attendance").select("*").eq("student_id", studentId).order("date", { ascending: false }).returns<AttendanceRecord[]>(),
    supabaseAdmin.from("communication_book").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).returns<CommMessage[]>(),
    supabaseAdmin.from("talent_gallery").select(GALLERY_SELECT).eq("audience", "student").eq("student_id", studentId).is("deleted_at", null).order("created_at", { ascending: false }).limit(60).returns<RawGalleryRow[]>(),
    supabaseAdmin.from("talent_gallery").select(GALLERY_SELECT).eq("audience", "class").eq("target_grade", gradeLabel).is("deleted_at", null).order("created_at", { ascending: false }).limit(40).returns<RawGalleryRow[]>(),
    supabaseAdmin.from("talent_gallery").select(GALLERY_SELECT).eq("audience", "school").is("deleted_at", null).order("created_at", { ascending: false }).limit(20).returns<RawGalleryRow[]>(),
    
    // FIX: Remove .returns here. maybeSingle() correctly returns JssPathway | null
    supabaseAdmin.from("jss_pathways").select("*").eq("student_id", studentId).maybeSingle(),
    
    supabaseAdmin.from("announcements").select("*").order("created_at", { ascending: false }).limit(50).returns<Announcement[]>(),
    supabaseAdmin.from("school_events").select("*").gte("start_date", new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]).order("start_date", { ascending: true }).limit(30).returns<SchoolEvent[]>(),
    supabaseAdmin.from("fee_payments").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).returns<FeePayment[]>(),
    supabaseAdmin.from("report_cards").select("*").eq("student_id", studentId).eq("status", "published").order("academic_year", { ascending: false }).order("term", { ascending: false }).returns<ParentReportCard[]>(),
  ]);

  // Cast the pathway specifically if inference is still being stubborn
  const pathway = pathwayResult as JssPathway | null;

  const seenIds = new Set<string>();
  const rawGallery: RawGalleryRow[] = [];
  const galleryCombined = [...(galleryStudent || []), ...(galleryClass || []), ...(gallerySchool || [])];
  
  for (const row of galleryCombined) {
    if (row?.id && !seenIds.has(row.id)) {
      seenIds.add(row.id);
      rawGallery.push(row);
    }
  }

  const gallery: GalleryItem[] = await Promise.all(rawGallery.map(mapGalleryRow));

  const safeNotifications = notifications ?? [];
  const safeMessages = messages ?? [];

  return {
    notifications: safeNotifications,
    diary,
    attendance: attendance ?? [],
    messages: safeMessages,
    competencies: [],
    gallery,
    pathway: pathway, // Now matches JssPathway | null
    announcements: announcements ?? [],
    events: events ?? [],
    feePayments: feePayments ?? [],
    reportCards: reportCards ?? [],
    unreadCount: (safeNotifications.filter((n) => !n.is_read).length) + (safeMessages.filter((m) => !m.is_read && m.sender_role !== "parent").length),
  };
}

export async function fetchChild(studentId: string): Promise<ChildWithAssessments | null> {
  const { data, error } = await supabaseAdmin
    .from("students")
    .select(STUDENT_WITH_ASSESSMENTS_SELECT)
    .eq("id", studentId)
    .single();

  if (error || !data) return null;
  return mapStudentRow(data as unknown as RawStudentRow);
}