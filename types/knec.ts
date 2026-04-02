// ============================================================
// lib/types/knec.ts
// Strictly-typed interfaces for KNEC exam exports
// Grade 3 MLP (Lower Primary) + Grade 6 KPSEA (Upper Primary)
// ============================================================

// ── Shared score types ────────────────────────────────────────────────────────

export type CbcScore = "EE" | "ME" | "AE" | "BE";

/** 1-4 KNEC rating scale (BE=1, AE=2, ME=3, EE=4) */
export type KnecRating = 1 | 2 | 3 | 4;

export const CBC_TO_RATING: Record<CbcScore, KnecRating> = {
  BE: 1,
  AE: 2,
  ME: 3,
  EE: 4,
};

export const RATING_TO_CBC: Record<KnecRating, CbcScore> = {
  1: "BE",
  2: "AE",
  3: "ME",
  4: "EE",
};

// ── Raw DB row types ──────────────────────────────────────────────────────────

export interface DbAssessmentRow {
  id: string;
  student_id: string;
  subject_name: string;
  strand_id: string;
  score: CbcScore | "N/A" | null;
  raw_score: number | null;
  max_score: number | null;
  is_final_sba: boolean | null;
  term: number;
  academic_year: number;
  offline_id: string | null;
}

export interface DbStudentRow {
  id: string;
  full_name: string;
  upi_number: string | null;
  assessment_number: string | null;
  gender: "Male" | "Female" | null;
  current_grade: string;
  readable_id: string | null;
}

export interface DbSubjectRow {
  id: string;
  name: string;
  code: string;
  level: string;
  knec_learning_area: string | null;
}

export interface DbHistoricalOverride {
  id: string;
  student_id: string;
  academic_year: number;
  knec_area: string;
  avg_percentage: number;
  source_school: string | null;
  entered_at: string;
  notes: string | null;
}

// ── Grade 3 MLP types ─────────────────────────────────────────────────────────

/** The 8 KNEC learning areas for Grade 3 MLP */
export const GRADE3_LEARNING_AREAS = [
  "Mathematical",
  "English",
  "Kiswahili",
  "Literacy",
  "Environmental",
  "Hygiene & Nutrition",
  "Religious Education",
  "Creative & Movement",
] as const;

export type Grade3LearningArea = (typeof GRADE3_LEARNING_AREAS)[number];

export interface Grade3StudentResult {
  studentId: string;
  fullName: string;
  upiNumber: string | null;
  gender: "Male" | "Female" | null;
  /** Rating 1-4 per learning area — null means no data */
  areas: Partial<Record<Grade3LearningArea, KnecRating>>;
  /** Validation issues that block export */
  issues: Grade3ValidationIssue[];
}

export type Grade3ValidationIssue =
  | { type: "missing_upi" }
  | { type: "missing_area"; area: Grade3LearningArea };

// ── Grade 6 KPSEA types ───────────────────────────────────────────────────────

/** The 5 KPSEA composite learning areas and their constituent subjects */
export const KPSEA_AREAS = [
  "English",
  "Kiswahili",
  "Mathematics",
  "Integrated Science",
  "Creative Arts & Social Studies",
] as const;

export type KPSEAArea = (typeof KPSEA_AREAS)[number];

/** Which knec_learning_area values roll up into each KPSEA composite area */
export const KPSEA_AREA_MAP: Record<KPSEAArea, string[]> = {
  English: ["English"],
  Kiswahili: ["Kiswahili"],
  Mathematics: ["Mathematics"],
  "Integrated Science": ["Science & Technology", "Agriculture", "Home Science"],
  "Creative Arts & Social Studies": [
    "Social Studies",
    "Religious Education",
    "Art & Craft",
    "Music",
    "Physical & Health Education",
  ],
};

export type HistoricalStatus = "complete" | "missing" | "override";

export interface YearSBAData {
  /** Which academic year this covers (e.g. 2024 = Grade 4) */
  year: number;
  /** Grade label for display */
  gradeLabel: string;
  /** Status of data for this year */
  status: HistoricalStatus;
  /** Average percentage per KPSEA area (undefined if missing) */
  areaPct: Partial<Record<KPSEAArea, number>>;
}

export interface IKPSEAScore {
  area: KPSEAArea;
  /** Average % across G4, G5, G6 — null if any year missing */
  avgPct: number | null;
  g4Pct: number | null;
  g5Pct: number | null;
  g6Pct: number | null;
  /** Final 60% SBA mark (avgPct * 0.6) */
  sba60: number | null;
}

export interface IHistoricalData {
  g4: YearSBAData;
  g5: YearSBAData;
  g6: YearSBAData;
}

export type KPSEAReadinessStatus =
  | "ready" // all years complete + has assessment_number
  | "missing_years" // G4 or G5 data absent
  | "missing_assessment_number" // no assessment_number registered
  | "missing_upi"; // no UPI

export interface KPSEAStudentRow {
  studentId: string;
  fullName: string;
  upiNumber: string | null;
  assessmentNumber: string | null;
  gender: "Male" | "Female" | null;
  historicalData: IHistoricalData;
  scores: IKPSEAScore[];
  /** Total SBA %: average of all area sba60 values */
  totalSBA: number | null;
  readinessStatus: KPSEAReadinessStatus;
  /** Flag indicating some years rely on manually-entered overrides */
  hasOverrides: boolean;
}

// ── Manual override input (for the modal form) ────────────────────────────────

export interface ManualOverrideInput {
  studentId: string;
  academicYear: number;
  knecArea: string;
  avgPercentage: number;
  sourceSchool: string;
  notes: string;
}

// ============================================================
// Grade 9 KESSCE types
// ============================================================

/** JSS core subjects used in KESSCE aggregation */
export const JSS_CORE_SUBJECTS = [
  "English & Literature",
  "Kiswahili & Kenya Sign Language",
  "Mathematics",
  "Integrated Science",
  "Social Studies",
  "Business Studies",
  "Agriculture",
  "Pre-Technical Studies",
  "Creative Arts & Sports",
  "Religious Education",
] as const;

export type JSSSubject = (typeof JSS_CORE_SUBJECTS)[number];

/**
 * Which pathway_cluster values are STEM-related.
 * Used for the 'Counseling Required' flag logic.
 */
export const STEM_CLUSTERS = [
  "Science & Technology",
  "Technical & Vocational",
  "Agriculture & Environment",
] as const;

export type STEMCluster = (typeof STEM_CLUSTERS)[number];

/** Senior school tracks written to the KESSCE export column */
export const SENIOR_SCHOOL_TRACKS = [
  "Science",
  "Arts & Sports Science",
  "Social Sciences",
  "Technical & Vocational Education and Training (TVET)",
  "Business",
  "Agriculture & Environment",
] as const;

export type SeniorSchoolTrack = (typeof SENIOR_SCHOOL_TRACKS)[number];

/** Maps pathway_cluster → recommended senior school track */
export const CLUSTER_TO_TRACK: Record<string, SeniorSchoolTrack> = {
  "Science & Technology": "Science",
  "Arts & Sports Science": "Arts & Sports Science",
  "Business & Entrepreneurship": "Business",
  "Humanities & Social Sciences": "Social Sciences",
  "Agriculture & Environment": "Agriculture & Environment",
  "Technical & Vocational":
    "Technical & Vocational Education and Training (TVET)",
};

// ── Strictly-typed DB row for jss_pathways ────────────────────────────────────

export interface DbJSSPathwayRow {
  id: string;
  student_id: string;
  recommended_pathway: string | null;
  strengths: string[] | null;
  interests: string[] | null;
  teacher_notes: string | null;
  updated_at: string | null;
  interest_areas: string[] | null;
  strong_subjects: string[] | null;
  career_interests: string[] | null;
  learning_style: string | null;
  pathway_cluster: string | null;
  ai_guidance: string | null;
  guidance_date: string | null;
}

// ── Per-subject 3-year average ─────────────────────────────────────────────────

export interface ISubjectAverage {
  subject: JSSSubject;
  g7Pct: number | null; // Grade 7 / JSS 1
  g8Pct: number | null; // Grade 8 / JSS 2
  g9Pct: number | null; // Grade 9 / JSS 3
  /** Mean of the available years (always calculated even if only 1 year present) */
  avgPct: number | null;
  /** True if fewer than 3 years of data are available */
  incomplete: boolean;
}

// ── JSS Pathway summary ────────────────────────────────────────────────────────

export interface IJSSPathway {
  pathwayCluster: string | null;
  recommendedPathway: string | null;
  seniorSchoolTrack: SeniorSchoolTrack | null;
  strengths: string[];
  interests: string[];
  interestAreas: string[];
  careerInterests: string[];
  learningStyle: string | null;
  /** Human-readable 'Learner Profile' summary for the KESSCE notes column */
  learnerProfile: string;
  aiGuidance: string | null;
  guidanceDate: string | null;
  teacherNotes: string | null;
}

// ── Counseling flag ────────────────────────────────────────────────────────────

export type CounselingReason =
  | "math_below_threshold_for_stem"
  | "science_below_threshold_for_stem"
  | "no_pathway_set"
  | "pathway_cluster_mismatch";

export interface CounselingFlag {
  required: boolean;
  reasons: CounselingReason[];
}

// ── Full KESSCE student package ────────────────────────────────────────────────

export interface IKESSCEResult {
  studentId: string;
  fullName: string;
  upiNumber: string | null;
  gender: "Male" | "Female" | null;
  readableId: string | null;
  subjectAverages: ISubjectAverage[];
  /** Average of all subject 3-year averages — the overall SBA score */
  overallAvgPct: number | null;
  pathway: IJSSPathway;
  counseling: CounselingFlag;
  /** Validation issues blocking export */
  exportIssues: KESSCEExportIssue[];
}

export type KESSCEExportIssue =
  | { type: "missing_upi" }
  | { type: "missing_pathway" }
  | { type: "missing_subject"; subject: JSSSubject }
  | { type: "counseling_required" };

// ── Readiness status (for the dashboard badge) ────────────────────────────────

export type KESSCEReadiness =
  | "ready"
  | "counseling_required"
  | "missing_data"
  | "missing_upi";
