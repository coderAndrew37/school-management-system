// lib/types/assessment.ts

export type CbcScore = "EE" | "ME" | "AE" | "BE";

export const SCORE_LABELS: Record<CbcScore, string> = {
  EE: "Exceeds Expectation",
  ME: "Meets Expectation",
  AE: "Approaching Expectation",
  BE: "Below Expectation",
};

export const SCORE_COLORS: Record<
  CbcScore,
  { bg: string; text: string; border: string; ring: string }
> = {
  EE: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-300",
    border: "border-emerald-500/40",
    ring: "ring-emerald-500/60",
  },
  ME: {
    bg: "bg-sky-500/20",
    text: "text-sky-300",
    border: "border-sky-500/40",
    ring: "ring-sky-500/60",
  },
  AE: {
    bg: "bg-amber-500/20",
    text: "text-amber-300",
    border: "border-amber-500/40",
    ring: "ring-amber-500/60",
  },
  BE: {
    bg: "bg-rose-500/20",
    text: "text-rose-300",
    border: "border-rose-500/40",
    ring: "ring-rose-500/60",
  },
};

// ── Strands Configuration ───────────────────────────────────────────────────

const LOWER_PRIMARY_STRANDS: Record<string, string[]> = {
  "Literacy Activities": [
    "listening-speaking",
    "reading-pre-reading",
    "writing-pre-writing",
    "language-structure",
  ],
  "Kiswahili Language Activities": [
    "kusikiliza-kuongea",
    "kusoma",
    "kuandika",
    "sarufi",
  ],
  "Mathematical Activities": [
    "numbers-number-operations",
    "pre-algebra",
    "measurement",
    "geometry",
    "data-handling",
  ],
  "Environmental Activities": [
    "living-non-living-things",
    "health-nutrition",
    "physical-environment",
    "social-environment",
    "weather-climate",
  ],
  "Creative Arts & Crafts": [
    "drawing-painting",
    "craft-work",
    "music-appreciation",
    "drama-movement",
  ],
  "Music & Movement": ["singing", "playing-instruments", "movement-rhythm"],
  "Religious Education": [
    "faith-identity",
    "moral-values",
    "community-service",
  ],
  "Physical Education": ["athletics", "games-sport", "health-fitness"],
};

const UPPER_PRIMARY_STRANDS: Record<string, string[]> = {
  English: ["listening-speaking", "reading", "writing", "grammar-language-use"],
  Kiswahili: ["kusikiliza-kuongea", "kusoma", "kuandika", "sarufi-matumizi"],
  Mathematics: [
    "numbers-number-operations",
    "algebra",
    "measurement",
    "geometry",
    "data-handling-probability",
  ],
  "Integrated Science": [
    "living-things",
    "non-living-things",
    "energy",
    "health-environment",
  ],
  "Social Studies": [
    "place-people",
    "resources-activities",
    "citizenship-governance",
    "regional-global",
  ],
  "Creative Arts": ["visual-arts", "performing-arts", "applied-arts"],
  Music: ["singing-performance", "theory-appreciation", "playing-instruments"],
  "Physical Education": [
    "athletics",
    "games-sport",
    "gymnastics",
    "health-fitness",
  ],
  "Life Skills": [
    "self-awareness",
    "communication",
    "critical-thinking",
    "social-skills",
  ],
  "Religious Education": [
    "faith-identity",
    "moral-values",
    "social-responsibility",
  ],
};

const JUNIOR_SECONDARY_STRANDS: Record<string, string[]> = {
  "English & Literature": [
    "listening-speaking",
    "reading",
    "writing",
    "grammar-language-use",
    "literature",
  ],
  "Kiswahili & Kenya Sign Language": [
    "kusikiliza-kuongea",
    "kusoma",
    "kuandika",
    "sarufi",
    "lugha-ishara",
  ],
  Mathematics: [
    "numbers-number-operations",
    "algebra",
    "geometry-measurement",
    "data-probability",
    "financial-mathematics",
  ],
  "Integrated Science": [
    "biology",
    "chemistry",
    "physics",
    "earth-environment",
  ],
  "Social Studies": [
    "geography",
    "history-government",
    "citizenship",
    "global-perspectives",
  ],
  "Business Studies": [
    "entrepreneurship",
    "financial-literacy",
    "marketing",
    "record-keeping",
  ],
  Agriculture: [
    "soil-crops",
    "animal-production",
    "farm-management",
    "agribusiness",
  ],
  "Pre-Technical Studies": [
    "design-drawing",
    "wood-metal-work",
    "electronics-basics",
    "home-science",
  ],
  "Creative Arts & Sports": [
    "visual-arts",
    "performing-arts",
    "sport-recreation",
    "digital-arts",
  ],
  "Religious Education": ["faith-beliefs", "moral-ethics", "social-justice"],
};

// ── Grade → Level mapping ─────────────────────────────────────────────────────

export type GradeLevel = "lower_primary" | "upper_primary" | "junior_secondary";

// This map remains for internal logic to determine the CBC band
export const GRADE_LEVEL_MAP: Record<string, GradeLevel> = {
  PP1: "lower_primary",
  PP2: "lower_primary",
  "Grade 1": "lower_primary",
  "Grade 2": "lower_primary",
  "Grade 3": "lower_primary",
  "Grade 4": "upper_primary",
  "Grade 5": "upper_primary",
  "Grade 6": "upper_primary",
  "Grade 7 / JSS 1": "junior_secondary",
  "Grade 8 / JSS 2": "junior_secondary",
  "Grade 9 / JSS 3": "junior_secondary",
};

const STRANDS_BY_LEVEL: Record<GradeLevel, Record<string, string[]>> = {
  lower_primary: LOWER_PRIMARY_STRANDS,
  upper_primary: UPPER_PRIMARY_STRANDS,
  junior_secondary: JUNIOR_SECONDARY_STRANDS,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** * Resolves a GradeLevel from a potentially complex grade label.
 * Handles both "Grade 4" and "Grade 4-North"
 */
export function resolveGradeLevel(gradeLabel: string): GradeLevel {
  // If label is "Grade 4-North", this splits it and takes "Grade 4"
  const baseGrade = gradeLabel.split("-")[0].trim();
  return GRADE_LEVEL_MAP[baseGrade] ?? "upper_primary";
}

/** Get strands for a subject at a given grade */
export function getStrands(gradeLabel: string, subjectName: string): string[] {
  const level = resolveGradeLevel(gradeLabel);
  return STRANDS_BY_LEVEL[level][subjectName] ?? ["general-performance"];
}

/** Get all subjects for a given grade level */
export function getSubjectsForLevel(gradeLabel: string): string[] {
  const level = resolveGradeLevel(gradeLabel);
  return Object.keys(STRANDS_BY_LEVEL[level]);
}

/** Format a strand_id for display (kebab-case → Title Case) */
export function formatStrand(strandId: string): string {
  return strandId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Narrative Contexts ────────────────────────────────────────────────────────

export const NARRATIVE_CONTEXT: Record<GradeLevel, string> = {
  lower_primary: `
Warm, encouraging, simple language for ages 4–9. 
Focus on behaviours and competencies. Positive and supportive. 
2–3 sentences (40–60 words).`.trim(),

  upper_primary: `
Clear, constructive language for ages 10–12. 
Acknowledge specific strengths and growth areas. 
2–3 sentences (50–70 words).`.trim(),

  junior_secondary: `
Professional language for ages 13–15. 
Addresses academic competencies, critical thinking, and character. 
3 sentences (60–80 words).`.trim(),
};

// ── Assessment Grid Types ─────────────────────────────────────────────────────

export interface AssessmentCell {
  assessmentId: string | null;
  score: CbcScore | null;
  dirty: boolean;
}

export type AssessmentGridState = Record<string, AssessmentCell>;

export interface GridStudent {
  id: string;
  full_name: string;
  readable_id: string | null;
  class_id: string; // Updated from current_grade to class_id
  narrative?: string | null;
}
