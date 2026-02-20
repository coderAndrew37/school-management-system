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

// ── Lower Primary Strands (PP1, PP2, Grade 1–3) ───────────────────────────────

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

// ── Upper Primary Strands (Grade 4–6) ────────────────────────────────────────

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

// ── Junior Secondary Strands (Grade 7–9 / JSS 1–3) ───────────────────────────

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

/** Get strands for a subject at a given grade */
export function getStrands(grade: string, subjectName: string): string[] {
  const level = GRADE_LEVEL_MAP[grade];
  if (!level) return ["general-performance"];
  return STRANDS_BY_LEVEL[level][subjectName] ?? ["general-performance"];
}

/** Get all subjects for a given grade level */
export function getSubjectsForLevel(grade: string): string[] {
  const level = GRADE_LEVEL_MAP[grade];
  if (!level) return [];
  return Object.keys(STRANDS_BY_LEVEL[level]);
}

/** Format a strand_id for display (kebab-case → Title Case) */
export function formatStrand(strandId: string): string {
  return strandId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Narrative context per grade band ─────────────────────────────────────────
// Used to craft age-appropriate AI narrative remarks

export const NARRATIVE_CONTEXT: Record<GradeLevel, string> = {
  lower_primary: `
You are writing a CBC report card narrative remark for a young learner (Pre-Primary or Grade 1–3, age 4–9).
Use warm, encouraging, simple language that parents and young children can understand.
Focus on observed behaviours and competencies rather than letter grades.
Keep the tone positive, supportive, and celebratory of growth.
Remarks should be 2–3 sentences (40–60 words).
  `.trim(),

  upper_primary: `
You are writing a CBC report card narrative remark for an upper primary learner (Grade 4–6, age 10–12).
Use clear, constructive language acknowledging specific strengths and areas for development.
Ground the remark in competencies observed in class activities and assignments.
Keep the tone encouraging but honest, 2–3 sentences (50–70 words).
  `.trim(),

  junior_secondary: `
You are writing a CBC report card narrative remark for a junior secondary learner (Grade 7–9 / JSS, age 13–15).
Use professional language that addresses the learner's academic competencies, critical thinking, and character.
Balance strengths with specific, actionable growth areas.
Keep the tone respectful and forward-looking, 3 sentences (60–80 words).
  `.trim(),
};

// ── Assessment grid cell type ─────────────────────────────────────────────────

export interface AssessmentCell {
  assessmentId: string | null; // null = not yet saved to DB
  score: CbcScore | null;
  dirty: boolean; // changed since last save
}

// Key: `${studentId}:${subjectName}:${strandId}`
export type AssessmentGridState = Record<string, AssessmentCell>;

export interface GridStudent {
  id: string;
  full_name: string;
  readable_id: string | null;
  current_grade: string;
  narrative?: string | null; // cached narrative remark
}
