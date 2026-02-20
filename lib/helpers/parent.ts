import type {
  Assessment,
  CbcScore,
  OverallLevel,
  RadarPoint,
  ScoreMeta,
  SubjectSummaryItem,
} from "@/lib/types/parent";

// ── CBC score lookup table ─────────────────────────────────────────────────────

export const CBC_SCORES: Record<CbcScore, ScoreMeta> = {
  EE: {
    label: "EE",
    description: "Exceeding Expectation",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    numeric: 4,
  },
  ME: {
    label: "ME",
    description: "Meeting Expectation",
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-200",
    numeric: 3,
  },
  AE: {
    label: "AE",
    description: "Approaching Expectation",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    numeric: 2,
  },
  BE: {
    label: "BE",
    description: "Below Expectation",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    numeric: 1,
  },
} as const;

// ── Date / name helpers ────────────────────────────────────────────────────────

export function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function formatDOB(dob: string): string {
  return new Date(dob).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

// ── Avatar colour ──────────────────────────────────────────────────────────────

const WARM_AVATAR_COLORS = [
  "from-orange-300 to-amber-400",
  "from-rose-300 to-pink-400",
  "from-amber-300 to-yellow-400",
  "from-teal-300 to-emerald-400",
  "from-sky-300 to-blue-400",
  "from-violet-300 to-purple-400",
] as const;

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return (
    WARM_AVATAR_COLORS[Math.abs(hash) % WARM_AVATAR_COLORS.length] ??
    WARM_AVATAR_COLORS[0]
  );
}

// ── Derived data helpers ───────────────────────────────────────────────────────

/** Returns the latest scored assessment per subject, sorted by most recent. */
export function getSubjectSummary(
  assessments: Assessment[],
): SubjectSummaryItem[] {
  const latest = new Map<string, Assessment>();

  const sorted = [...assessments].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const assessment of sorted) {
    if (assessment.score !== null && !latest.has(assessment.subject_name)) {
      latest.set(assessment.subject_name, assessment);
    }
  }

  return Array.from(latest.values()).map((assessment) => {
    // Type-safe: we filtered score !== null above, and CbcScore is the only
    // non-null value per the Assessment interface.
    const score = assessment.score as CbcScore;
    return {
      subject: assessment.subject_name,
      score,
      numeric: CBC_SCORES[score].numeric,
    };
  });
}

/** Computes an overall performance level from the average numeric score. */
export function getOverallLevel(assessments: Assessment[]): OverallLevel {
  const scored = assessments.filter(
    (a): a is Assessment & { score: CbcScore } => a.score !== null,
  );

  if (scored.length === 0) {
    return { label: "No data yet", emoji: "📚", color: "text-stone-400" };
  }

  const avg =
    scored.reduce((sum, a) => sum + CBC_SCORES[a.score].numeric, 0) /
    scored.length;

  if (avg >= 3.5)
    return {
      label: "Exceeding Expectation",
      emoji: "🌟",
      color: "text-emerald-600",
    };
  if (avg >= 2.5)
    return { label: "Meeting Expectation", emoji: "✅", color: "text-sky-600" };
  if (avg >= 1.5)
    return {
      label: "Approaching Expectation",
      emoji: "📈",
      color: "text-amber-600",
    };
  return { label: "Needs Support", emoji: "💪", color: "text-rose-600" };
}

/** Builds radar chart data from assessments (latest score per subject). */
export function buildRadarData(assessments: Assessment[]): RadarPoint[] {
  return getSubjectSummary(assessments).map(({ subject, numeric }) => ({
    subject: subject.length > 14 ? `${subject.slice(0, 12)}…` : subject,
    score: numeric,
    fullMark: 4 as const,
  }));
}

/** Extracts unique, sorted term numbers from an assessment list. */
export function getTerms(assessments: Assessment[]): Array<1 | 2 | 3> {
  const unique = new Set<1 | 2 | 3>();
  for (const a of assessments) {
    unique.add(a.term);
  }
  return [...unique].sort() as Array<1 | 2 | 3>;
}

/** Groups assessments by subject name. */
export function groupBySubject(
  assessments: Assessment[],
): Map<string, Assessment[]> {
  const groups = new Map<string, Assessment[]>();
  for (const a of assessments) {
    const existing = groups.get(a.subject_name);
    if (existing) {
      existing.push(a);
    } else {
      groups.set(a.subject_name, [a]);
    }
  }
  return groups;
}
