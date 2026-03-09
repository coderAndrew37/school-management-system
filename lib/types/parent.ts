import type { Student, Parent } from "@/lib/types/dashboard";

// ── CBC ────────────────────────────────────────────────────────────────────────

export type CbcScore = "EE" | "ME" | "AE" | "BE";

export interface ScoreMeta {
  label: CbcScore;
  description: string;
  color: string;
  bg: string;
  border: string;
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

// ── Supabase raw shape ────────────────────────────────────────────────────────

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

// ── Domain model ──────────────────────────────────────────────────────────────

export interface ChildWithAssessments extends Student {
  assessments: Assessment[];
}

// ── Derived shapes ────────────────────────────────────────────────────────────

export interface SubjectSummaryItem {
  subject: string;
  score: CbcScore;
  numeric: 1 | 2 | 3 | 4;
}

export interface OverallLevel {
  label: string;
  emoji: string;
  color: string;
}

export interface RadarPoint {
  subject: string;
  score: 1 | 2 | 3 | 4;
  fullMark: 4;
}

// ── Component props ───────────────────────────────────────────────────────────

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
  active: 0 | 1 | 2 | 3;
  onSelect: (term: 0 | 1 | 2 | 3) => void;
}

export interface ParentShellProps {
  children: React.ReactNode;
}

// ── Talent Gallery ────────────────────────────────────────────────────────────

export type GalleryCategory =
  | "Academic"
  | "Sports"
  | "Arts"
  | "Leadership"
  | "Tech";

/**
 * GalleryItem — mapped from the talent_gallery DB table.
 *
 * IMPORTANT column-name notes (DB → app field):
 *   DB `tags`        → app `tags`        (text[], legacy)
 *   DB `description` → app `description` (text, legacy)
 *   DB `media_url`   → storage PATH, not a usable URL — use `signedUrl`
 *
 * Audience tiers:
 *   "student" → specific child
 *   "class"   → whole grade (target_grade is set)
 *   "school"  → all parents
 */
export interface GalleryItem {
  id: string;

  // ownership / audience
  student_id: string | null;
  target_grade: string | null;
  audience: "student" | "class" | "school";
  teacher_id: string | null;

  // content
  title: string;
  caption: string | null;
  description: string | null; // legacy column, still on the DB
  category: string | null;
  media_type: "image" | "video";

  /**
   * media_url — raw Supabase Storage PATH e.g. "{teacher_id}/{uuid}.jpg".
   * Never pass to <img src>. Always use signedUrl.
   */
  media_url: string;

  /**
   * signedUrl — 1-hour signed URL hydrated server-side.
   * Empty string if signing failed.
   */
  signedUrl: string;

  // legacy fields — present on old rows
  tags: string[]; // DB column `tags` text[]

  // context
  term: number | null;
  academic_year: number | null;
  created_at: string;
}

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

export const GALLERY_CAT_DEFAULT: {
  icon: string;
  bg: string;
  text: string;
  border: string;
} = {
  icon: "🖼️",
  bg: "bg-slate-500/10",
  text: "text-slate-400",
  border: "border-slate-500/20",
};

export const GALLERY_AUDIENCE_STYLE: Record<
  "student" | "class" | "school",
  { label: string; bg: string; text: string }
> = {
  student: { label: "Your child", bg: "bg-sky-500/10", text: "text-sky-400" },
  class: { label: "Class", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  school: { label: "School", bg: "bg-purple-500/10", text: "text-purple-400" },
};

// ── Diary ─────────────────────────────────────────────────────────────────────

export interface DiaryEntry {
  id: string;
  student_id: string;
  subject_name: string | null;
  title: string;
  body: string;
  homework: string | null;
  diary_date: string;
  due_date: string | null;
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
  thread_id: string;
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

// ── JSS Pathway ───────────────────────────────────────────────────────────────

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
  link_to?: string;
  created_at: string;
}

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

// ── Attendance ────────────────────────────────────────────────────────────────

/**
 * CAPITALISED to match exact DB storage values.
 * The attendance table stores "Present" / "Absent" / "Late" / "Excused".
 * Using lowercase was causing TS2367 "no overlap" errors on every status comparison.
 */
export type AttendanceStatus = "Present" | "Late" | "Absent" | "Excused";

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
  marked_by?: string;
}

export const STATUS_COLOR: Record<
  AttendanceStatus,
  { bg: string; text: string; border: string; dot: string }
> = {
  Present: {
    bg: "bg-emerald-400/10",
    text: "text-emerald-400",
    border: "border-emerald-400/20",
    dot: "bg-emerald-400",
  },
  Late: {
    bg: "bg-amber-400/10",
    text: "text-amber-400",
    border: "border-amber-400/20",
    dot: "bg-amber-400",
  },
  Absent: {
    bg: "bg-rose-400/10",
    text: "text-rose-400",
    border: "border-rose-400/20",
    dot: "bg-rose-400",
  },
  Excused: {
    bg: "bg-sky-400/10",
    text: "text-sky-400",
    border: "border-sky-400/20",
    dot: "bg-sky-400",
  },
};

// ── Competencies ──────────────────────────────────────────────────────────────

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
  critical_thinking: number;
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
