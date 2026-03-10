// lib/helpers/parent.ts — Light-mode helper types and utilities
import type { Student } from "@/lib/types/dashboard";
import type { CbcScore } from "@/lib/types/assessment";
import { Assessment, RadarPoint } from "../types/parent";

// Add this line at the top with your other imports/exports
export type { CbcScore } from "@/lib/types/assessment";

export interface AssessmentRow {
  subject_name: string;
  strand_id: string;
  score: string | null;
}
export interface ChildProfileClientProps {
  child: Student & { assessments: AssessmentRow[] };
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

// CBC score badge — light-mode .b-green / .b-teal / .b-amber / .b-red pairs
export const CBC_SCORES: Record<
  CbcScore,
  { description: string; bg: string; color: string; border: string }
> = {
  EE: {
    description: "Exceeds Expectation",
    bg: "bg-emerald-100",
    color: "text-emerald-700",
    border: "border-emerald-200",
  },
  ME: {
    description: "Meets Expectation",
    bg: "bg-cyan-100",
    color: "text-cyan-700",
    border: "border-cyan-200",
  },
  AE: {
    description: "Approaching Expectation",
    bg: "bg-amber-100",
    color: "text-amber-700",
    border: "border-amber-200",
  },
  BE: {
    description: "Below Expectation",
    bg: "bg-red-100",
    color: "text-red-700",
    border: "border-red-200",
  },
};

const GRADIENTS = [
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-purple-500 to-violet-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
];

export function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}
export function getAvatarColor(name: string) {
  return GRADIENTS[name.charCodeAt(0) % GRADIENTS.length]!;
}
export function calcAge(dob: string) {
  const b = new Date(dob),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (
    n.getMonth() - b.getMonth() < 0 ||
    (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())
  )
    a--;
  return a;
}
export function formatDOB(dob: string) {
  return new Date(dob + "T00:00:00").toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
export function getOverallLevel(assessments: AssessmentRow[]): {
  emoji: string;
  label: string;
  score: CbcScore | null;
  color?: string;
} {
  const valid = assessments.filter((a) => a.score) as (AssessmentRow & {
    score: CbcScore;
  })[];
  if (!valid.length) return { emoji: "—", label: "Not assessed", score: null };
  const counts: Record<string, number> = {};
  for (const a of valid) counts[a.score] = (counts[a.score] ?? 0) + 1;
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as
    | CbcScore
    | undefined;
  const MAP: Record<CbcScore, { emoji: string; label: string }> = {
    EE: { emoji: "🌟", label: "Exceeding" },
    ME: { emoji: "✅", label: "Meeting" },
    AE: { emoji: "📈", label: "Approaching" },
    BE: { emoji: "⚠️", label: "Below" },
  };
  return top
    ? { ...MAP[top], score: top }
    : { emoji: "—", label: "Not assessed", score: null };
}
export function getSubjectSummary(
  assessments: AssessmentRow[],
): { subject: string; score: CbcScore }[] {
  const bySubject = new Map<string, CbcScore>();
  const order: CbcScore[] = ["EE", "ME", "AE", "BE"];
  for (const a of assessments) {
    if (!a.score) continue;
    const prev = bySubject.get(a.subject_name);
    if (!prev || order.indexOf(a.score as CbcScore) < order.indexOf(prev))
      bySubject.set(a.subject_name, a.score as CbcScore);
  }
  return [...bySubject.entries()].map(([subject, score]) => ({
    subject,
    score,
  }));
}

export function getTerms(assessments: Assessment[]): number[] {
  const terms = new Set(assessments.map((a) => a.term));
  return Array.from(terms).sort((a, b) => a - b);
}

/**
 * Groups assessments by their subject name
 */
export function groupBySubject(
  assessments: Assessment[],
): Map<string, Assessment[]> {
  const map = new Map<string, Assessment[]>();
  assessments.forEach((a) => {
    const list = map.get(a.subject_name) || [];
    list.push(a);
    map.set(a.subject_name, list);
  });
  return map;
}

/**
 * Converts CBC scores to numeric values for the Radar Chart
 */
const SCORE_MAP: Record<CbcScore, number> = {
  EE: 4,
  ME: 3,
  AE: 2,
  BE: 1,
};

export function buildRadarData(assessments: Assessment[]): RadarPoint[] {
  const latestBySubject = new Map<string, number>();

  assessments.forEach((a) => {
    if (a.score) {
      latestBySubject.set(a.subject_name, SCORE_MAP[a.score]);
    }
  });

  return Array.from(latestBySubject.entries()).map(([subject, score]) => ({
    subject,
    score: score as 1 | 2 | 3 | 4,
    fullMark: 4,
  }));
}
