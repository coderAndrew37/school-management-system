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
