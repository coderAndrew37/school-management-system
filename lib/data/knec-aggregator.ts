// ============================================================
// lib/data/knec-aggregator.ts
// Grade 3 MLP — aggregate final SBA scores into KNEC 1-4 ratings
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CbcScore,
  DbAssessmentRow,
  DbStudentRow,
  DbSubjectRow,
  Grade3LearningArea,
  Grade3StudentResult,
  Grade3ValidationIssue,
  KnecRating,
} from "@/types/knec";
import { CBC_TO_RATING, GRADE3_LEARNING_AREAS } from "@/types/knec";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert raw_score / max_score percentage into a 1-4 rating */
function pctToRating(pct: number): KnecRating {
  if (pct >= 75) return 4;
  if (pct >= 50) return 3;
  if (pct >= 25) return 2;
  return 1;
}

/** Mode of an array of scores (most frequent wins; ties go to highest) */
function modeScore(scores: CbcScore[]): CbcScore {
  const counts: Partial<Record<CbcScore, number>> = {};
  for (const s of scores) counts[s] = (counts[s] ?? 0) + 1;
  const order: CbcScore[] = ["EE", "ME", "AE", "BE"];
  let best: CbcScore = "BE";
  let bestCount = 0;
  for (const sc of order) {
    const c = counts[sc] ?? 0;
    if (c > bestCount) {
      bestCount = c;
      best = sc;
    }
  }
  return best;
}

/**
 * Given a list of assessment rows for one student + one learning area,
 * compute the final 1-4 KNEC rating.
 *
 * Priority:
 *   1. If any row has raw_score + max_score → average the percentages → rating
 *   2. Otherwise → mode of the CbcScore values → rating
 */
function calcAreaRating(rows: DbAssessmentRow[]): KnecRating | null {
  if (rows.length === 0) return null;

  const withPct = rows.filter(
    (r) =>
      r.raw_score !== null && r.max_score !== null && (r.max_score ?? 0) > 0,
  );

  if (withPct.length > 0) {
    const avg =
      withPct.reduce((sum, r) => sum + (r.raw_score! / r.max_score!) * 100, 0) /
      withPct.length;
    return pctToRating(avg);
  }

  const validScores = rows
    .map((r) => r.score)
    .filter(
      (s): s is CbcScore =>
        s === "EE" || s === "ME" || s === "AE" || s === "BE",
    );

  if (validScores.length === 0) return null;
  return CBC_TO_RATING[modeScore(validScores)];
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetch and aggregate all Grade 3 students' final SBA data
 * into KNEC-ready 1-4 ratings per learning area.
 *
 * Designed so the fetching logic can be swapped for TanStack Query
 * by wrapping this function in a server action + cache layer.
 */
export async function getGrade3KnecData(
  grade: string = "Grade 3",
  year: number = 2026,
): Promise<Grade3StudentResult[]> {
  const supabase = await createSupabaseServerClient();

  // 1. Students
  const { data: rawStudents, error: sErr } = await supabase
    .from("students")
    .select(
      "id, full_name, upi_number, assessment_number, gender, current_grade, readable_id",
    )
    .eq("current_grade", grade)
    .eq("status", "active")
    .order("full_name");

  if (sErr) {
    console.error("[getGrade3KnecData] students:", sErr.message);
    return [];
  }

  const students = (rawStudents ?? []) as DbStudentRow[];
  if (students.length === 0) return [];

  const studentIds = students.map((s) => s.id);

  // 2. Final SBA assessments for this year
  const { data: rawAssessments, error: aErr } = await supabase
    .from("assessments")
    .select(
      "id, student_id, subject_name, strand_id, score, raw_score, max_score, is_final_sba, term, academic_year, offline_id",
    )
    .in("student_id", studentIds)
    .eq("is_final_sba", true)
    .eq("academic_year", year);

  if (aErr) {
    console.error("[getGrade3KnecData] assessments:", aErr.message);
    return [];
  }

  const assessments = (rawAssessments ?? []) as DbAssessmentRow[];

  // 3. Subjects → knec_learning_area map
  const { data: rawSubjects, error: subErr } = await supabase
    .from("subjects")
    .select("id, name, code, level, knec_learning_area")
    .eq("level", "lower_primary");

  if (subErr) {
    console.error("[getGrade3KnecData] subjects:", subErr.message);
    return [];
  }

  const subjects = (rawSubjects ?? []) as DbSubjectRow[];

  // Build subject_name → knec_learning_area lookup
  const areaBySubject = new Map<string, string>();
  for (const sub of subjects) {
    if (sub.knec_learning_area)
      areaBySubject.set(sub.name, sub.knec_learning_area);
  }

  // 4. Group assessments: studentId → learningArea → rows[]
  const grouped = new Map<string, Map<string, DbAssessmentRow[]>>();
  for (const a of assessments) {
    const area = areaBySubject.get(a.subject_name);
    if (!area) continue;
    if (!grouped.has(a.student_id)) grouped.set(a.student_id, new Map());
    const byArea = grouped.get(a.student_id)!;
    if (!byArea.has(area)) byArea.set(area, []);
    byArea.get(area)!.push(a);
  }

  // 5. Build results
  return students.map((student) => {
    const byArea =
      grouped.get(student.id) ?? new Map<string, DbAssessmentRow[]>();
    const areas: Partial<Record<Grade3LearningArea, KnecRating>> = {};
    const issues: Grade3ValidationIssue[] = [];

    if (!student.upi_number) {
      issues.push({ type: "missing_upi" });
    }

    for (const la of GRADE3_LEARNING_AREAS) {
      const rows = byArea.get(la) ?? [];
      const rating = calcAreaRating(rows);
      if (rating !== null) {
        areas[la] = rating;
      } else {
        issues.push({ type: "missing_area", area: la });
      }
    }

    return {
      studentId: student.id,
      fullName: student.full_name,
      upiNumber: student.upi_number,
      gender: student.gender,
      areas,
      issues,
    } satisfies Grade3StudentResult;
  });
}
