import type { Student, Parent } from "@/lib/types/dashboard";

// ── CBC ────────────────────────────────────────────────────────────────────────

export type CbcScore = "EE" | "ME" | "AE" | "BE";

export interface ScoreMeta {
  label: CbcScore;
  description: string;
  /** Tailwind text-color class */
  color: string;
  /** Tailwind bg-color class */
  bg: string;
  /** Tailwind border-color class */
  border: string;
  /** Numeric value used for radar chart: EE=4, ME=3, AE=2, BE=1 */
  numeric: 1 | 2 | 3 | 4;
}

// ── Assessment ─────────────────────────────────────────────────────────────────

export interface Assessment {
  id: string;
  student_id: string;
  teacher_id: string;
  subject_name: string;
  strand_id: string;
  score: CbcScore | null;
  evidence_url: string | null;
  teacher_remarks: string | null;
  term: 1 | 2 | 3;
  academic_year: number;
  created_at: string;
}

// ── Supabase raw shape returned by the joined query ───────────────────────────
// Keeps the cast surface minimal — one place to trust, everywhere else is typed.

export interface StudentRow {
  id: string;
  readable_id: string | null;
  upi_number: string | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  parent_id: string | null;
  created_at: string;
  parents: Pick<Parent, "full_name" | "phone_number"> | null;
  assessments: Assessment[];
}

// ── Domain model exposed to components ────────────────────────────────────────

export interface ChildWithAssessments extends Student {
  assessments: Assessment[];
}

// ── Derived / computed shapes ─────────────────────────────────────────────────

export interface SubjectSummaryItem {
  subject: string;
  score: CbcScore;
  numeric: 1 | 2 | 3 | 4;
}

export interface OverallLevel {
  label: string;
  emoji: string;
  /** Tailwind text-color class */
  color: string;
}

export interface RadarPoint {
  subject: string;
  score: 1 | 2 | 3 | 4;
  fullMark: 4;
}

// ── Component prop interfaces ─────────────────────────────────────────────────

export interface ParentHomeClientProps {
  children: ChildWithAssessments[];
  parentName: string;
}

export interface ChildSwitcherProps {
  children: ChildWithAssessments[];
  activeId: string;
  onSelect: (id: string) => void;
}

export interface ChildDashboardProps {
  child: ChildWithAssessments;
}

export interface ChildProfileClientProps {
  child: ChildWithAssessments;
}

export interface ProgressReportClientProps {
  child: ChildWithAssessments;
}

export interface ScoreBadgeProps {
  score: CbcScore;
}

export interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: "amber" | "emerald" | "sky" | "rose";
}

export interface CompetencyRadarProps {
  data: RadarPoint[];
}

export interface AssessmentCardProps {
  assessment: Assessment;
}

export interface TermTabsProps {
  terms: Array<1 | 2 | 3>;
  active: 0 | 1 | 2 | 3; // 0 = all terms
  onSelect: (term: 0 | 1 | 2 | 3) => void;
}

export interface ParentShellProps {
  children: React.ReactNode;
}

// ── Talent Gallery ───────────────────────────────────────────────────────────

export type GalleryCategory =
  | "Academic"
  | "Sports"
  | "Arts"
  | "Leadership"
  | "Tech";

export interface GalleryItem {
  id: string;
  student_id: string;
  title: string;
  description?: string;
  media_type: "image" | "video" | "audio" | "document";
  media_url: string;
  category: GalleryCategory;
  skills_tagged: string[];
  captured_on: string; // ISO Date string (YYYY-MM-DD)
  created_at: string;
}

/** * Styling mapping for the different gallery categories
 * used for badges, filters, and lightboxes.
 */
export const GALLERY_CAT_STYLE: Record<
  GalleryCategory,
  { icon: string; bg: string; text: string; border: string }
> = {
  Academic: {
    icon: "📚",
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/20",
  },
  Sports: {
    icon: "🏆",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  Arts: {
    icon: "🎨",
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
  Leadership: {
    icon: "🌟",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  Tech: {
    icon: "💻",
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
  },
};

// ── Diary & Communication ─────────────────────────────────────────────────────

export interface DiaryEntry {
  id: string;
  student_id: string;
  /** The subject this entry relates to (e.g., "Mathematics", "Science") */
  subject_name: string | null;
  /** The headline or topic of the diary entry */
  title: string;
  /** The main content/message from the teacher */
  body: string;
  /** Specific homework instructions, if any */
  homework: string | null;
  /** The date the diary was written (ISO YYYY-MM-DD) */
  diary_date: string;
  /** The date the homework is due (ISO YYYY-MM-DD) */
  due_date: string | null;
  /** The name of the teacher/staff who wrote the entry */
  author_name: string;
  created_at: string;
}

// ── Communication Book ────────────────────────────────────────────────────────

export type MessageCategory =
  | "general"
  | "behaviour"
  | "academic"
  | "health"
  | "pastoral"
  | "urgent";

export interface CommMessage {
  id: string;
  thread_id: string; // Used to group replies together
  student_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: "parent" | "teacher" | "admin";
  subject: string | null;
  body: string;
  category: MessageCategory;
  is_read: boolean;
  created_at: string;
}

/**
 * Styling mapping for communication categories
 */
export const CATEGORY_STYLE: Record<
  MessageCategory,
  { bg: string; text: string; border: string }
> = {
  general: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/20",
  },
  academic: {
    bg: "bg-sky-500/10",
    text: "text-sky-400",
    border: "border-sky-500/20",
  },
  behaviour: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
  },
  health: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
  },
  pastoral: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
  },
  urgent: {
    bg: "bg-rose-500/10",
    text: "text-rose-400",
    border: "border-rose-500/20",
  },
};

// ── JSS Pathway Guidance ──────────────────────────────────────────────────────

export interface JssPathway {
  id: string;
  student_id: string;
  interest_areas: string[];
  strong_subjects: string[];
  career_interests: string[];
  learning_style: string;
  pathway_cluster: string;
  ai_guidance: string | null;
  guidance_date: string | null;
  updated_at: string;
}

export const JSS_INTEREST_AREAS = [
  "Technology & Coding",
  "Arts & Design",
  "Sports & Athletics",
  "Leadership & Management",
  "Environment & Nature",
  "Public Speaking",
  "Music & Performance",
  "Scientific Research",
  "Engineering & Building",
  "Community Service",
];

export const JSS_PATHWAY_CLUSTERS: Record<
  string,
  { icon: string; careers: string[] }
> = {
  "STEM (Science, Tech, Engineering, Maths)": {
    icon: "🧬",
    careers: [
      "Engineer",
      "Doctor",
      "Software Dev",
      "Architect",
      "Data Scientist",
    ],
  },
  "Social Sciences & Humanities": {
    icon: "⚖️",
    careers: ["Lawyer", "Journalist", "Diplomat", "Psychologist", "Teacher"],
  },
  "Arts & Sports": {
    icon: "🎨",
    careers: [
      "Artist",
      "Professional Athlete",
      "Designer",
      "Musician",
      "Coach",
    ],
  },
  "Business & Technical": {
    icon: "💼",
    careers: ["Entrepreneur", "Accountant", "Pilot", "Technician", "Chef"],
  },
};

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | "attendance"
  | "diary"
  | "message"
  | "finance"
  | "academic"
  | "system";

export interface StudentNotification {
  id: string;
  student_id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  link_to?: string; // Optional path for internal navigation
  created_at: string;
}

/**
 * Visual configuration for notification icons and status
 */
export const NOTIF_STYLE: Record<
  NotificationType,
  { icon: string; color: string }
> = {
  attendance: { icon: "📅", color: "sky" },
  diary: { icon: "📔", color: "amber" },
  message: { icon: "💬", color: "emerald" },
  finance: { icon: "💳", color: "rose" },
  academic: { icon: "🎓", color: "purple" },
  system: { icon: "⚙️", color: "slate" },
};

// ── Attendance ──────────────────────────────────────────────────────────────

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string; // ISO Format YYYY-MM-DD
  status: AttendanceStatus;
  notes?: string;
  marked_by?: string;
}

/**
 * Visual styling for attendance calendar and list items
 */
export const STATUS_COLOR: Record<
  AttendanceStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  present: {
    bg: "bg-emerald-400/10",
    text: "text-emerald-400",
    border: "border-emerald-400/20",
    dot: "bg-emerald-400",
  },
  late: {
    bg: "bg-amber-400/10",
    text: "text-amber-400",
    border: "border-amber-400/20",
    dot: "bg-amber-400",
  },
  absent: {
    bg: "bg-rose-400/10",
    text: "text-rose-400",
    border: "border-rose-400/20",
    dot: "bg-rose-400",
  },
  excused: {
    bg: "bg-sky-400/10",
    text: "text-sky-400",
    border: "border-sky-400/20",
    dot: "bg-sky-400",
  },
};

// ── Talent & Competencies ─────────────────────────────────────────────────────

export type CompetencyKey =
  | "critical_thinking"
  | "creativity"
  | "communication"
  | "collaboration"
  | "self_efficacy"
  | "digital_literacy"
  | "citizenship"
  | "learning_to_learn";

export interface TalentCompetency {
  id: string;
  student_id: string;
  term: number;
  year: number;
  critical_thinking: number; // Scale 1-5
  creativity: number;
  communication: number;
  collaboration: number;
  self_efficacy: number;
  digital_literacy: number;
  citizenship: number;
  learning_to_learn: number;
  teacher_comments?: string;
  updated_at: string;
}

/**
 * Metadata for the Radar Chart domains
 */
export const COMPETENCY_DOMAINS: {
  key: CompetencyKey;
  label: string;
  icon: string;
  color: string;
}[] = [
  {
    key: "critical_thinking",
    label: "Critical Thinking",
    icon: "🧠",
    color: "#f87171",
  },
  { key: "creativity", label: "Creativity", icon: "🎨", color: "#fb923c" },
  {
    key: "communication",
    label: "Communication",
    icon: "📢",
    color: "#fbbf24",
  },
  {
    key: "collaboration",
    label: "Collaboration",
    icon: "🤝",
    color: "#4ade80",
  },
  {
    key: "self_efficacy",
    label: "Self Efficacy",
    icon: "💪",
    color: "#2dd4bf",
  },
  {
    key: "digital_literacy",
    label: "Digital Literacy",
    icon: "💻",
    color: "#38bdf8",
  },
  { key: "citizenship", label: "Citizenship", icon: "🇰🇪", color: "#818cf8" },
  {
    key: "learning_to_learn",
    label: "Learning to Learn",
    icon: "📚",
    color: "#c084fc",
  },
];
