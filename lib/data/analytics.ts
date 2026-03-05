import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GRADE_LEVEL_MAP } from "@/lib/types/assessment";
import { ALL_GRADES } from "@/lib/types/allocation";

// ── Score → numeric weight (for computing weighted means) ────────────────────
export const SCORE_WEIGHT: Record<string, number> = {
  EE: 4,
  ME: 3,
  AE: 2,
  BE: 1,
};

export const SCORE_LABEL: Record<string, string> = {
  EE: "Exceeds Expectation",
  ME: "Meets Expectation",
  AE: "Approaching Expectation",
  BE: "Below Expectation",
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GradeSnapshot {
  grade: string;
  level: string;
  studentCount: number;
  assessedCount: number; // students with at least one assessment
  eeCount: number;
  meCount: number;
  aeCount: number;
  beCount: number;
  totalScores: number;
  weightedMean: number; // 1–4 scale
}

export interface SubjectSnapshot {
  subjectName: string;
  grade: string;
  eeCount: number;
  meCount: number;
  aeCount: number;
  beCount: number;
  total: number;
  weightedMean: number;
  eePercent: number;
  mePercent: number;
  aePercent: number;
  bePercent: number;
}

export interface StudentPerformanceSummary {
  studentId: string;
  fullName: string;
  readableId: string | null;
  grade: string;
  eeCount: number;
  meCount: number;
  aeCount: number;
  beCount: number;
  totalAssessed: number;
  weightedMean: number;
  dominantScore: "EE" | "ME" | "AE" | "BE" | null;
}

export interface AnalyticsOverview {
  totalStudents: number;
  totalTeachers: number;
  totalAssessments: number;
  gradeSnapshots: GradeSnapshot[];
  subjectSnapshots: SubjectSnapshot[];
  topPerformers: StudentPerformanceSummary[];
  needsSupport: StudentPerformanceSummary[];
  scoreDistribution: { score: string; count: number; percent: number }[];
  subjectLeaderboard: {
    subjectName: string;
    weightedMean: number;
    total: number;
  }[];
  gradeEnrollment: { grade: string; count: number; level: string }[];
}

// ── Internal bucket type — separates numeric score counts from the student Set

type CbcScoreKey = "EE" | "ME" | "AE" | "BE";

interface GradeScoreBucket {
  EE: number;
  ME: number;
  AE: number;
  BE: number;
  students: Set<string>;
}

// ── Main analytics fetch ──────────────────────────────────────────────────────

export async function fetchAnalyticsOverview(
  term = 1,
  academicYear = 2026,
): Promise<AnalyticsOverview> {
  const supabase = await createSupabaseServerClient();

  // 1. Counts
  const [studentsRes, teachersRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, readable_id, current_grade")
      .order("full_name"),
    supabase.from("teachers").select("id", { count: "exact", head: true }),
  ]);

  const students = (studentsRes.data ?? []) as {
    id: string;
    full_name: string;
    readable_id: string | null;
    current_grade: string;
  }[];
  const totalTeachers = teachersRes.count ?? 0;

  // 2. All assessments for this term/year
  const { data: assessData } = await supabase
    .from("assessments")
    .select("id, student_id, subject_name, strand_id, score")
    .eq("term", term)
    .eq("academic_year", academicYear)
    .not("score", "is", null);

  const assessments = (assessData ?? []) as {
    id: string;
    student_id: string;
    subject_name: string;
    strand_id: string;
    score: string;
  }[];

  // 3. Aggregate by student
  const studentMap: Record<
    string,
    { id: string; fullName: string; readableId: string | null; grade: string }
  > = {};
  for (const s of students) {
    studentMap[s.id] = {
      id: s.id,
      fullName: s.full_name,
      readableId: s.readable_id,
      grade: s.current_grade,
    };
  }

  // Per-student score counts
  const studentScores: Record<string, Record<CbcScoreKey, number>> = {};
  for (const a of assessments) {
    if (!studentScores[a.student_id])
      studentScores[a.student_id] = { EE: 0, ME: 0, AE: 0, BE: 0 };
    const sc = studentScores[a.student_id]!;
    sc[a.score as CbcScoreKey] = (sc[a.score as CbcScoreKey] ?? 0) + 1;
  }

  // Per-grade score counts
  const gradeScores: Record<string, GradeScoreBucket> = {};
  for (const a of assessments) {
    const grade = studentMap[a.student_id]?.grade;
    if (!grade) continue;
    if (!gradeScores[grade])
      gradeScores[grade] = { EE: 0, ME: 0, AE: 0, BE: 0, students: new Set() };
    const bucket = gradeScores[grade]!;
    bucket[a.score as CbcScoreKey] = (bucket[a.score as CbcScoreKey] ?? 0) + 1;
    bucket.students.add(a.student_id);
  }

  // Per-subject score counts
  const subjectGradeScores: Record<string, Record<CbcScoreKey, number>> = {};
  const subjectGradeCount: Record<string, string> = {}; // key → grade
  for (const a of assessments) {
    const grade = studentMap[a.student_id]?.grade;
    if (!grade) continue;
    const key = `${a.subject_name}__${grade}`;
    if (!subjectGradeScores[key]) {
      subjectGradeScores[key] = { EE: 0, ME: 0, AE: 0, BE: 0 };
      subjectGradeCount[key] = grade;
    }
    const sc = subjectGradeScores[key]!;
    sc[a.score as CbcScoreKey] = (sc[a.score as CbcScoreKey] ?? 0) + 1;
  }

  // 4. Build grade enrollment
  const enrollmentMap: Record<string, number> = {};
  for (const s of students) {
    enrollmentMap[s.current_grade] = (enrollmentMap[s.current_grade] ?? 0) + 1;
  }
  const gradeEnrollment = ALL_GRADES.map((g) => ({
    grade: g,
    count: enrollmentMap[g] ?? 0,
    level: GRADE_LEVEL_MAP[g] ?? "lower_primary",
  })).filter((g) => g.count > 0);

  // 5. Build grade snapshots
  const gradeSnapshots: GradeSnapshot[] = ALL_GRADES.filter(
    (g) => enrollmentMap[g],
  ).map((g) => {
    const sc = gradeScores[g];
    const ee = sc?.EE ?? 0,
      me = sc?.ME ?? 0,
      ae = sc?.AE ?? 0,
      be = sc?.BE ?? 0;
    const total = ee + me + ae + be;
    const wm =
      total > 0 ? +((ee * 4 + me * 3 + ae * 2 + be * 1) / total).toFixed(2) : 0;
    return {
      grade: g,
      level: GRADE_LEVEL_MAP[g] ?? "lower_primary",
      studentCount: enrollmentMap[g] ?? 0,
      assessedCount: sc?.students.size ?? 0,
      eeCount: ee,
      meCount: me,
      aeCount: ae,
      beCount: be,
      totalScores: total,
      weightedMean: wm,
    };
  });

  // 6. Build subject snapshots
  const subjectSnapshots: SubjectSnapshot[] = Object.entries(subjectGradeScores)
    .map(([key, sc]) => {
      const [subjectName, grade] = key.split("__") as [string, string];
      const ee = sc.EE ?? 0,
        me = sc.ME ?? 0,
        ae = sc.AE ?? 0,
        be = sc.BE ?? 0;
      const total = ee + me + ae + be;
      const wm =
        total > 0
          ? +((ee * 4 + me * 3 + ae * 2 + be * 1) / total).toFixed(2)
          : 0;
      return {
        subjectName,
        grade,
        eeCount: ee,
        meCount: me,
        aeCount: ae,
        beCount: be,
        total,
        weightedMean: wm,
        eePercent: total > 0 ? Math.round((ee / total) * 100) : 0,
        mePercent: total > 0 ? Math.round((me / total) * 100) : 0,
        aePercent: total > 0 ? Math.round((ae / total) * 100) : 0,
        bePercent: total > 0 ? Math.round((be / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // 7. Build student performance summaries
  const studentSummaries: StudentPerformanceSummary[] = students
    .filter((s) => studentScores[s.id])
    .map((s) => {
      const sc = studentScores[s.id]!;
      const ee = sc.EE ?? 0,
        me = sc.ME ?? 0,
        ae = sc.AE ?? 0,
        be = sc.BE ?? 0;
      const total = ee + me + ae + be;
      const wm =
        total > 0
          ? +((ee * 4 + me * 3 + ae * 2 + be * 1) / total).toFixed(2)
          : 0;
      const dominant =
        total > 0
          ? (["EE", "ME", "AE", "BE"] as const).reduce((best, cur) =>
              (sc[cur] ?? 0) > (sc[best] ?? 0) ? cur : best,
            )
          : null;
      return {
        studentId: s.id,
        fullName: s.full_name,
        readableId: s.readable_id,
        grade: s.current_grade,
        eeCount: ee,
        meCount: me,
        aeCount: ae,
        beCount: be,
        totalAssessed: total,
        weightedMean: wm,
        dominantScore: dominant,
      };
    })
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // 8. Subject leaderboard (across all grades, aggregate)
  const subjectAgg: Record<string, { total: number; weightedSum: number }> = {};
  for (const ss of subjectSnapshots) {
    if (!subjectAgg[ss.subjectName])
      subjectAgg[ss.subjectName] = { total: 0, weightedSum: 0 };
    subjectAgg[ss.subjectName]!.total += ss.total;
    subjectAgg[ss.subjectName]!.weightedSum += ss.weightedMean * ss.total;
  }
  const subjectLeaderboard = Object.entries(subjectAgg)
    .map(([subjectName, v]) => ({
      subjectName,
      total: v.total,
      weightedMean: v.total > 0 ? +(v.weightedSum / v.total).toFixed(2) : 0,
    }))
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // 9. Overall score distribution
  const distAgg: Record<CbcScoreKey, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
  for (const a of assessments) {
    distAgg[a.score as CbcScoreKey] =
      (distAgg[a.score as CbcScoreKey] ?? 0) + 1;
  }
  const distTotal = distAgg.EE + distAgg.ME + distAgg.AE + distAgg.BE;
  const scoreDistribution = (["EE", "ME", "AE", "BE"] as const).map((s) => ({
    score: s,
    count: distAgg[s],
    percent: distTotal > 0 ? Math.round((distAgg[s] / distTotal) * 100) : 0,
  }));

  return {
    totalStudents: students.length,
    totalTeachers,
    totalAssessments: assessments.length,
    gradeSnapshots,
    subjectSnapshots,
    topPerformers: studentSummaries.slice(0, 10),
    needsSupport: [...studentSummaries].reverse().slice(0, 10),
    scoreDistribution,
    subjectLeaderboard,
    gradeEnrollment,
  };
}

// ── Fetch per-grade, per-subject detail (for drill-down) ─────────────────────

export interface GradeAnalyticsDetail {
  grade: string;
  subjects: SubjectSnapshot[];
  students: StudentPerformanceSummary[];
  scoreDistribution: { score: string; count: number; percent: number }[];
}

export async function fetchGradeAnalytics(
  grade: string,
  term = 1,
  academicYear = 2026,
): Promise<GradeAnalyticsDetail> {
  const supabase = await createSupabaseServerClient();

  const [studentsRes, assessRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, readable_id, current_grade")
      .eq("current_grade", grade)
      .order("full_name"),
    supabase
      .from("assessments")
      .select("id, student_id, subject_name, strand_id, score")
      .eq("term", term)
      .eq("academic_year", academicYear)
      .not("score", "is", null),
  ]);

  const students = (studentsRes.data ?? []) as {
    id: string;
    full_name: string;
    readable_id: string | null;
    current_grade: string;
  }[];
  const studentIds = new Set(students.map((s) => s.id));
  const assessments = (
    (assessRes.data ?? []) as {
      id: string;
      student_id: string;
      subject_name: string;
      strand_id: string;
      score: string;
    }[]
  ).filter((a) => studentIds.has(a.student_id));

  // Subject breakdown
  const subjectScores: Record<string, Record<CbcScoreKey, number>> = {};
  for (const a of assessments) {
    if (!subjectScores[a.subject_name])
      subjectScores[a.subject_name] = { EE: 0, ME: 0, AE: 0, BE: 0 };
    const sc = subjectScores[a.subject_name]!;
    sc[a.score as CbcScoreKey] = (sc[a.score as CbcScoreKey] ?? 0) + 1;
  }
  const subjects: SubjectSnapshot[] = Object.entries(subjectScores)
    .map(([subjectName, sc]) => {
      const ee = sc.EE ?? 0,
        me = sc.ME ?? 0,
        ae = sc.AE ?? 0,
        be = sc.BE ?? 0;
      const total = ee + me + ae + be;
      const wm =
        total > 0
          ? +((ee * 4 + me * 3 + ae * 2 + be * 1) / total).toFixed(2)
          : 0;
      return {
        subjectName,
        grade,
        eeCount: ee,
        meCount: me,
        aeCount: ae,
        beCount: be,
        total,
        weightedMean: wm,
        eePercent: total > 0 ? Math.round((ee / total) * 100) : 0,
        mePercent: total > 0 ? Math.round((me / total) * 100) : 0,
        aePercent: total > 0 ? Math.round((ae / total) * 100) : 0,
        bePercent: total > 0 ? Math.round((be / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // Student breakdown
  const studentScores: Record<string, Record<CbcScoreKey, number>> = {};
  for (const a of assessments) {
    if (!studentScores[a.student_id])
      studentScores[a.student_id] = { EE: 0, ME: 0, AE: 0, BE: 0 };
    const sc = studentScores[a.student_id]!;
    sc[a.score as CbcScoreKey] = (sc[a.score as CbcScoreKey] ?? 0) + 1;
  }
  const studentSummaries: StudentPerformanceSummary[] = students
    .map((s) => {
      const sc = studentScores[s.id] ?? { EE: 0, ME: 0, AE: 0, BE: 0 };
      const ee = sc.EE ?? 0,
        me = sc.ME ?? 0,
        ae = sc.AE ?? 0,
        be = sc.BE ?? 0;
      const total = ee + me + ae + be;
      const wm =
        total > 0
          ? +((ee * 4 + me * 3 + ae * 2 + be * 1) / total).toFixed(2)
          : 0;
      const dominant =
        total > 0
          ? (["EE", "ME", "AE", "BE"] as const).reduce((best, cur) =>
              (sc[cur] ?? 0) > (sc[best] ?? 0) ? cur : best,
            )
          : null;
      return {
        studentId: s.id,
        fullName: s.full_name,
        readableId: s.readable_id,
        grade,
        eeCount: ee,
        meCount: me,
        aeCount: ae,
        beCount: be,
        totalAssessed: total,
        weightedMean: wm,
        dominantScore: dominant,
      };
    })
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // Overall distribution
  const distAgg: Record<CbcScoreKey, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
  for (const a of assessments)
    distAgg[a.score as CbcScoreKey] =
      (distAgg[a.score as CbcScoreKey] ?? 0) + 1;
  const distTotal = distAgg.EE + distAgg.ME + distAgg.AE + distAgg.BE;
  const scoreDistribution = (["EE", "ME", "AE", "BE"] as const).map((s) => ({
    score: s,
    count: distAgg[s],
    percent: distTotal > 0 ? Math.round((distAgg[s] / distTotal) * 100) : 0,
  }));

  return { grade, subjects, students: studentSummaries, scoreDistribution };
}
