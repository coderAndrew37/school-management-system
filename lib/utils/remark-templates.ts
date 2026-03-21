// lib/utils/remark-templates.ts
// Client-side template remark generator.
// Builds a personalised, score-aware default remark without an API call.
// Teachers can edit before saving; AI generate is available for richer text.

import type { CbcScore } from "@/lib/types/assessment";
import { GRADE_LEVEL_MAP, formatStrand } from "@/lib/types/assessment";

// ── Score counts ──────────────────────────────────────────────────────────────

interface ScoreSummary {
  EE: string[]; // strand names scoring EE
  ME: string[];
  AE: string[];
  BE: string[];
  total: number;
}

export function summariseScores(
  studentId: string,
  subjectName: string,
  strands: string[],
  grid: Record<string, { score: CbcScore | null }>,
): ScoreSummary {
  const summary: ScoreSummary = { EE: [], ME: [], AE: [], BE: [], total: 0 };
  for (const strand of strands) {
    const key = `${studentId}:${subjectName}:${strand}`;
    const score = grid[key]?.score;
    if (score) {
      summary[score].push(formatStrand(strand));
      summary.total++;
    }
  }
  return summary;
}

// ── Overall performance level ─────────────────────────────────────────────────

function overallLevel(
  s: ScoreSummary,
): "excellent" | "good" | "fair" | "needs-support" {
  if (s.total === 0) return "good";
  const pct = (s.EE.length + s.ME.length) / s.total;
  if (pct >= 0.8 && s.BE.length === 0) return "excellent";
  if (pct >= 0.6) return "good";
  if (pct >= 0.4) return "fair";
  return "needs-support";
}

// ── Grade-band vocabulary ─────────────────────────────────────────────────────

const VOCAB = {
  lower_primary: {
    excellent: [
      "shows great enthusiasm",
      "is doing wonderfully",
      "has been a star learner",
    ],
    good: [
      "is making good progress",
      "is working hard",
      "is growing in confidence",
    ],
    fair: [
      "is making steady progress",
      "is developing well",
      "is building their skills",
    ],
    "needs-support": [
      "is working at their own pace",
      "is making small steps forward",
      "needs extra support",
    ],
    strength: [
      "really enjoys",
      "shows a natural ability in",
      "has shown strength in",
    ],
    growth: [
      "is still learning",
      "is developing their skills in",
      "needs more practice with",
    ],
    close: [
      "Keep up the great work!",
      "With continued practice, they will shine!",
      "Encouragement at home will make a big difference.",
    ],
  },
  upper_primary: {
    excellent: [
      "demonstrates an excellent grasp of",
      "excels in",
      "has shown outstanding performance in",
    ],
    good: [
      "is performing well in",
      "demonstrates solid understanding of",
      "is making commendable progress in",
    ],
    fair: [
      "is making reasonable progress in",
      "shows developing competency in",
      "is working to strengthen their skills in",
    ],
    "needs-support": [
      "requires additional support in",
      "is finding aspects of",
      "needs focused attention in",
    ],
    strength: [
      "particularly strong in",
      "excels notably in",
      "demonstrates confidence in",
    ],
    growth: [
      "could benefit from more practice in",
      "needs to consolidate",
      "should focus on strengthening",
    ],
    close: [
      "Continue to encourage regular practice.",
      "Consistent revision will support further improvement.",
      "With focused effort, further gains are within reach.",
    ],
  },
  junior_secondary: {
    excellent: [
      "demonstrates exceptional competency in",
      "has achieved a high level of proficiency in",
      "consistently exceeds expectations in",
    ],
    good: [
      "performs competently in",
      "demonstrates a solid understanding of",
      "meets expectations across most areas of",
    ],
    fair: [
      "is developing competency in",
      "shows emerging skills in",
      "demonstrates a foundational understanding of",
    ],
    "needs-support": [
      "requires targeted support in",
      "faces challenges in certain aspects of",
      "would benefit from additional focus on",
    ],
    strength: [
      "particularly proficient in",
      "demonstrates notable strength in",
      "excels in areas such as",
    ],
    growth: [
      "would benefit from deeper engagement with",
      "should prioritise strengthening",
      "needs to address gaps in",
    ],
    close: [
      "Continued effort and engagement will yield further improvement.",
      "A targeted revision plan is recommended.",
      "With commitment, a higher level of achievement is attainable.",
    ],
  },
};

// ── Template builder ──────────────────────────────────────────────────────────

export function buildTemplateRemark(
  studentName: string,
  grade: string,
  subjectName: string,
  summary: ScoreSummary,
): string {
  const level = GRADE_LEVEL_MAP[grade] ?? "upper_primary";
  const v = VOCAB[level];
  const perf = overallLevel(summary);

  // No scores yet — return a neutral prompt
  if (summary.total === 0) {
    return `${studentName} is working through ${subjectName} this term. Assessment scores will be reflected in a more detailed remark once all strands are completed.`;
  }

  const firstName = studentName.split(" ")[0] ?? studentName;

  // Sentence 1: overall performance
  const perfPhrases = v[perf];
  const perfPhrase =
    perfPhrases[Math.floor(Math.random() * perfPhrases.length)];
  let sentence1: string;

  if (level === "lower_primary") {
    sentence1 = `${firstName} ${perfPhrase} in ${subjectName} this term.`;
  } else {
    sentence1 = `${firstName} ${perfPhrase} ${subjectName} this term.`;
  }

  // Sentence 2: specific strengths or growth areas
  let sentence2 = "";
  const strongStrands = [...summary.EE, ...summary.ME].slice(0, 2);
  const weakStrands = [...summary.BE, ...summary.AE].slice(0, 1);

  if (strongStrands.length > 0 && weakStrands.length === 0) {
    // All good — highlight strengths
    const strengthPhrase =
      v.strength[Math.floor(Math.random() * v.strength.length)];
    sentence2 = `${level === "lower_primary" ? "They" : firstName} ${strengthPhrase} ${strongStrands.join(" and ")}.`;
  } else if (strongStrands.length > 0 && weakStrands.length > 0) {
    // Mixed — acknowledge strength and area for growth
    const strengthPhrase =
      v.strength[Math.floor(Math.random() * v.strength.length)];
    const growthPhrase = v.growth[Math.floor(Math.random() * v.growth.length)];
    const subject2 = level === "lower_primary" ? "They" : firstName;
    sentence2 = `${subject2} ${strengthPhrase} ${strongStrands[0]} but ${growthPhrase} ${weakStrands[0]}.`;
  } else if (weakStrands.length > 0) {
    // Mostly weak — focus on support
    const growthPhrase = v.growth[Math.floor(Math.random() * v.growth.length)];
    sentence2 = `${level === "lower_primary" ? "They" : firstName} ${growthPhrase} ${weakStrands.join(" and ")}.`;
  }

  // Sentence 3: closing encouragement
  const close = v.close[Math.floor(Math.random() * v.close.length)];

  return [sentence1, sentence2, close].filter(Boolean).join(" ");
}
