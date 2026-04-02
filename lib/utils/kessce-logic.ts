// lib/utils/kessce-logic.ts
import type {
  CounselingFlag,
  CounselingReason,
  DbAssessmentRow,
  DbJSSPathwayRow,
  DbStudentRow,
  IJSSPathway,
  IKESSCEResult,
  ISubjectAverage,
  KESSCEExportIssue,
  KESSCEReadiness,
  SeniorSchoolTrack,
} from "@/types/knec";
import {
  CLUSTER_TO_TRACK,
  JSS_CORE_SUBJECTS,
  STEM_CLUSTERS,
} from "@/types/knec";

const STEM_THRESHOLD = 50;
const SCORE_TO_PCT: Record<string, number> = {
  EE: 87.5,
  ME: 62.5,
  AE: 37.5,
  BE: 12.5,
};

/** Compute average % for a set of assessment rows */
export function calcSubjectYearPct(rows: DbAssessmentRow[]): number | null {
  if (rows.length === 0) return null;
  const withRaw = rows.filter(
    (r) =>
      r.raw_score !== null && r.max_score !== null && (r.max_score ?? 0) > 0,
  );
  if (withRaw.length > 0) {
    return (
      withRaw.reduce((sum, r) => sum + (r.raw_score! / r.max_score!) * 100, 0) /
      withRaw.length
    );
  }
  const withScore = rows.filter((r) => r.score && r.score in SCORE_TO_PCT);
  if (withScore.length === 0) return null;
  return (
    withScore.reduce((sum, r) => sum + SCORE_TO_PCT[r.score!]!, 0) /
    withScore.length
  );
}

/** Build Learner Profile string */
export function buildLearnerProfile(pathway: DbJSSPathwayRow): string {
  const parts: string[] = [];
  const strengths = pathway.strengths ?? [];
  const interests = pathway.interest_areas ?? pathway.interests ?? [];
  const careers = pathway.career_interests ?? [];
  if (strengths.length > 0)
    parts.push(`Strengths: ${strengths.slice(0, 4).join(", ")}.`);
  if (interests.length > 0)
    parts.push(`Interest areas: ${interests.slice(0, 3).join(", ")}.`);
  if (careers.length > 0)
    parts.push(`Career aspirations: ${careers.slice(0, 3).join(", ")}.`);
  return parts.length > 0
    ? parts.join(" ")
    : "No learner profile data available.";
}

/** Map pathway_cluster → IJSSPathway */
export function buildPathwayObject(row: DbJSSPathwayRow | null): IJSSPathway {
  const cluster = row?.pathway_cluster ?? null;
  const track: SeniorSchoolTrack | null =
    cluster && cluster in CLUSTER_TO_TRACK
      ? (CLUSTER_TO_TRACK[cluster] ?? null)
      : null;

  return {
    pathwayCluster: cluster,
    recommendedPathway: row?.recommended_pathway ?? null,
    seniorSchoolTrack: track,
    strengths: row?.strengths ?? [],
    interests: row?.interests ?? [],
    interestAreas: row?.interest_areas ?? [],
    careerInterests: row?.career_interests ?? [],
    learningStyle: row?.learning_style ?? null,
    learnerProfile: row
      ? buildLearnerProfile(row)
      : "No learner profile data available.",
    aiGuidance: row?.ai_guidance ?? null,
    guidanceDate: row?.guidance_date ?? null,
    teacherNotes: row?.teacher_notes ?? null,
  };
}

/** Evaluate counseling flags */
export function buildCounselingFlag(
  subjectAverages: ISubjectAverage[],
  pathway: IJSSPathway,
): CounselingFlag {
  const reasons: CounselingReason[] = [];
  if (!pathway.pathwayCluster) {
    reasons.push("no_pathway_set");
    return { required: true, reasons };
  }
  if (STEM_CLUSTERS.includes(pathway.pathwayCluster as any)) {
    const mathAvg = subjectAverages.find(
      (s) => s.subject === "Mathematics",
    )?.avgPct;
    const sciAvg = subjectAverages.find(
      (s) => s.subject === "Integrated Science",
    )?.avgPct;
    if (mathAvg !== null && mathAvg !== undefined && mathAvg < STEM_THRESHOLD)
      reasons.push("math_below_threshold_for_stem");
    if (sciAvg !== null && sciAvg !== undefined && sciAvg < STEM_THRESHOLD)
      reasons.push("science_below_threshold_for_stem");
  }
  return { required: reasons.length > 0, reasons };
}

/** Determine export readiness issues */
export function buildExportIssues(
  student: DbStudentRow,
  pathway: IJSSPathway,
  subjectAverages: ISubjectAverage[],
  counseling: CounselingFlag,
): KESSCEExportIssue[] {
  const issues: KESSCEExportIssue[] = [];
  if (!student.upi_number) issues.push({ type: "missing_upi" });
  if (!pathway.pathwayCluster) issues.push({ type: "missing_pathway" });
  for (const sa of subjectAverages) {
    if (sa.avgPct === null)
      issues.push({ type: "missing_subject", subject: sa.subject });
  }
  if (counseling.required) issues.push({ type: "counseling_required" });
  return issues;
}

/** Simple readiness status for UI badges */
export function getKESSCEReadiness(result: IKESSCEResult): KESSCEReadiness {
  if (result.exportIssues.some((i) => i.type === "missing_upi"))
    return "missing_upi";
  if (
    result.exportIssues.some(
      (i) => i.type === "missing_subject" || i.type === "missing_pathway",
    )
  )
    return "missing_data";
  if (result.counseling.required) return "counseling_required";
  return "ready";
}

/** The Core Builder used to transform DB rows into the Result Object */
export function buildKESSCEResult(
  student: DbStudentRow,
  assessments: DbAssessmentRow[],
  pathwayRow: DbJSSPathwayRow | null,
  g9Year: number,
): IKESSCEResult {
  const years = [g9Year - 2, g9Year - 1, g9Year];
  const bySubjectYear = new Map<string, Map<number, DbAssessmentRow[]>>();

  for (const a of assessments) {
    if (!bySubjectYear.has(a.subject_name))
      bySubjectYear.set(a.subject_name, new Map());
    const byYear = bySubjectYear.get(a.subject_name)!;
    if (!byYear.has(a.academic_year)) byYear.set(a.academic_year, []);
    byYear.get(a.academic_year)!.push(a);
  }

  const subjectAverages: ISubjectAverage[] = JSS_CORE_SUBJECTS.map(
    (subject) => {
      const byYear = bySubjectYear.get(subject) ?? new Map();
      const g7Pct = calcSubjectYearPct(byYear.get(years[0]) ?? []);
      const g8Pct = calcSubjectYearPct(byYear.get(years[1]) ?? []);
      const g9Pct = calcSubjectYearPct(byYear.get(years[2]) ?? []);
      const available = [g7Pct, g8Pct, g9Pct].filter(
        (v): v is number => v !== null,
      );
      const avgPct =
        available.length > 0
          ? available.reduce((a, b) => a + b, 0) / available.length
          : null;

      return {
        subject,
        g7Pct,
        g8Pct,
        g9Pct,
        avgPct: avgPct !== null ? parseFloat(avgPct.toFixed(2)) : null,
        incomplete: available.length < 3,
      };
    },
  );

  const validAvgs = subjectAverages
    .map((s) => s.avgPct)
    .filter((v): v is number => v !== null);
  const overallAvg =
    validAvgs.length > 0
      ? parseFloat(
          (validAvgs.reduce((a, b) => a + b, 0) / validAvgs.length).toFixed(2),
        )
      : null;

  const pathway = buildPathwayObject(pathwayRow);
  const counseling = buildCounselingFlag(subjectAverages, pathway);
  const exportIssues = buildExportIssues(
    student,
    pathway,
    subjectAverages,
    counseling,
  );

  return {
    studentId: student.id,
    fullName: student.full_name,
    upiNumber: student.upi_number,
    gender: student.gender,
    readableId: student.readable_id,
    subjectAverages,
    overallAvgPct: overallAvg,
    pathway,
    counseling,
    exportIssues,
  };
}
