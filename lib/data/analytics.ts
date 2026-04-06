// lib/data/analytics.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GRADE_LEVEL_MAP } from "@/lib/types/assessment";

// ── Score helpers ─────────────────────────────────────────────────────────────

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

type CbcScore = "EE" | "ME" | "AE" | "BE";

function wm(ee: number, me: number, ae: number, be: number): number {
  const t = ee + me + ae + be;
  return t > 0 ? +((ee * 4 + me * 3 + ae * 2 + be * 1) / t).toFixed(2) : 0;
}

// ── Core types ────────────────────────────────────────────────────────────────

export interface GradeSnapshot {
  grade: string;
  level: string;
  studentCount: number;
  assessedCount: number;
  male: number;
  female: number;
  eeCount: number;
  meCount: number;
  aeCount: number;
  beCount: number;
  totalScores: number;
  weightedMean: number;
  coverageRate: number; // % students with at least one assessment
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
  dominantScore: CbcScore | null;
}

export interface TermComparisonRow {
  grade: string;
  level: string;
  t1: number; // Term 1 weighted mean (0 = no data)
  t2: number; // Term 2 weighted mean (0 = no data)
  t3: number; // Term 3 weighted mean (0 = no data)
  delta: number; // latest available term minus earliest available term
}

export interface AttendanceSnapshot {
  grade: string;
  level: string;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  rate: number; // present / total
}

export interface AnalyticsOverview {
  totalStudents: number;
  totalTeachers: number;
  totalAssessments: number;
  term: number;
  academicYear: number;
  // Coverage
  coverageRate: number; // % students assessed this term
  avgMean: number; // school-wide weighted mean
  // Charts data
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
  gradeEnrollment: {
    grade: string;
    count: number;
    male: number;
    female: number;
    level: string;
  }[];
  termComparison: TermComparisonRow[];
  attendanceByGrade: AttendanceSnapshot[];
  // Admissions trend (last 6 months)
  admissionsTrend: { month: string; count: number }[];
}

// ── Main fetch ────────────────────────────────────────────────────────────────

export async function fetchAnalyticsOverview(
  term = 1,
  academicYear = 2026,
): Promise<AnalyticsOverview> {
  const supabase = await createSupabaseServerClient();

  // ── Parallel fetches ──────────────────────────────────────────────────────
  const [studentsRes, teachersRes, assessAllTermsRes, attendanceRes] =
    await Promise.all([
      supabase
        .from("students")
        .select(
          "id, full_name, readable_id, current_grade, gender, created_at, status",
        )
        .eq("status", "active")
        .order("full_name"),
      supabase.from("teachers").select("id", { count: "exact", head: true }),
      // All 3 terms for the year — needed for term comparison chart
      supabase
        .from("assessments")
        .select("id, student_id, subject_name, score, term")
        .eq("academic_year", academicYear)
        .not("score", "is", null),
      supabase
        .from("attendance")
        .select("student_id, status")
        .eq("academic_year", academicYear)
        .eq("term", term),
    ]);

  const students = (studentsRes.data ?? []) as {
    id: string;
    full_name: string;
    readable_id: string | null;
    current_grade: string;
    gender: string | null;
    created_at: string;
  }[];

  const totalTeachers = teachersRes.count ?? 0;
  const allAssessments = (assessAllTermsRes.data ?? []) as {
    id: string;
    student_id: string;
    subject_name: string;
    score: string;
    term: number;
  }[];

  // Filter to the selected term
  const assessments = allAssessments.filter((a) => a.term === term);

  const attendanceRows = (attendanceRes.data ?? []) as {
    student_id: string;
    status: string;
  }[];

  // ── Lookup maps ───────────────────────────────────────────────────────────
  const studentMap: Record<string, { grade: string; gender: string | null }> =
    {};
  const enrollMap: Record<
    string,
    { total: number; male: number; female: number }
  > = {};

  for (const s of students) {
    studentMap[s.id] = { grade: s.current_grade, gender: s.gender };
    if (!enrollMap[s.current_grade])
      enrollMap[s.current_grade] = { total: 0, male: 0, female: 0 };
    enrollMap[s.current_grade]!.total++;
    if (s.gender === "Male") enrollMap[s.current_grade]!.male++;
    if (s.gender === "Female") enrollMap[s.current_grade]!.female++;
  }

  // Generate unique list of grades from actual data to replace ALL_GRADES
  const uniqueGrades = Array.from(
    new Set(students.map((s) => s.current_grade)),
  ).sort();

  // ── Grade enrollment ──────────────────────────────────────────────────────
  const gradeEnrollment = uniqueGrades
    .filter((g) => enrollMap[g])
    .map((g) => ({
      grade: g,
      count: enrollMap[g]!.total,
      male: enrollMap[g]!.male,
      female: enrollMap[g]!.female,
      level: GRADE_LEVEL_MAP[g] ?? "lower_primary",
    }));

  // ── Per-grade score buckets (current term) ────────────────────────────────
  const gradeScores: Record<
    string,
    { EE: number; ME: number; AE: number; BE: number; students: Set<string> }
  > = {};
  for (const a of assessments) {
    const grade = studentMap[a.student_id]?.grade;
    if (!grade) continue;
    if (!gradeScores[grade])
      gradeScores[grade] = { EE: 0, ME: 0, AE: 0, BE: 0, students: new Set() };
    const b = gradeScores[grade]!;
    b[a.score as CbcScore] = (b[a.score as CbcScore] ?? 0) + 1;
    b.students.add(a.student_id);
  }

  // ── Grade snapshots ───────────────────────────────────────────────────────
  const gradeSnapshots: GradeSnapshot[] = uniqueGrades
    .filter((g) => enrollMap[g])
    .map((g) => {
      const sc = gradeScores[g];
      const ee = sc?.EE ?? 0,
        me = sc?.ME ?? 0,
        ae = sc?.AE ?? 0,
        be = sc?.BE ?? 0;
      const enrolled = enrollMap[g]!.total;
      return {
        grade: g,
        level: GRADE_LEVEL_MAP[g] ?? "lower_primary",
        studentCount: enrolled,
        assessedCount: sc?.students.size ?? 0,
        male: enrollMap[g]!.male,
        female: enrollMap[g]!.female,
        eeCount: ee,
        meCount: me,
        aeCount: ae,
        beCount: be,
        totalScores: ee + me + ae + be,
        weightedMean: wm(ee, me, ae, be),
        coverageRate:
          enrolled > 0
            ? Math.round(((sc?.students.size ?? 0) / enrolled) * 100)
            : 0,
      };
    });

  // ── Subject × grade buckets ───────────────────────────────────────────────
  const subjectGrade: Record<
    string,
    { EE: number; ME: number; AE: number; BE: number }
  > = {};
  for (const a of assessments) {
    const grade = studentMap[a.student_id]?.grade;
    if (!grade) continue;
    const key = `${a.subject_name}__${grade}`;
    if (!subjectGrade[key]) subjectGrade[key] = { EE: 0, ME: 0, AE: 0, BE: 0 };
    const sc = subjectGrade[key]!;
    sc[a.score as CbcScore] = (sc[a.score as CbcScore] ?? 0) + 1;
  }

  const subjectSnapshots: SubjectSnapshot[] = Object.entries(subjectGrade)
    .map(([key, sc]) => {
      const [subjectName, grade] = key.split("__") as [string, string];
      const ee = sc.EE,
        me = sc.ME,
        ae = sc.AE,
        be = sc.BE;
      const total = ee + me + ae + be;
      return {
        subjectName,
        grade,
        eeCount: ee,
        meCount: me,
        aeCount: ae,
        beCount: be,
        total,
        weightedMean: wm(ee, me, ae, be),
        eePercent: total > 0 ? Math.round((ee / total) * 100) : 0,
        mePercent: total > 0 ? Math.round((me / total) * 100) : 0,
        aePercent: total > 0 ? Math.round((ae / total) * 100) : 0,
        bePercent: total > 0 ? Math.round((be / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // ── Subject leaderboard ───────────────────────────────────────────────────
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

  // ── Per-student summaries ─────────────────────────────────────────────────
  const studentScores: Record<string, Record<CbcScore, number>> = {};
  for (const a of assessments) {
    if (!studentScores[a.student_id])
      studentScores[a.student_id] = { EE: 0, ME: 0, AE: 0, BE: 0 };
    const sc = studentScores[a.student_id]!;
    sc[a.score as CbcScore] = (sc[a.score as CbcScore] ?? 0) + 1;
  }

  const studentSummaries: StudentPerformanceSummary[] = students
    .filter((s) => studentScores[s.id])
    .map((s) => {
      const sc = studentScores[s.id]!;
      const ee = sc.EE,
        me = sc.ME,
        ae = sc.AE,
        be = sc.BE;
      const total = ee + me + ae + be;
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
        weightedMean: wm(ee, me, ae, be),
        dominantScore: dominant,
      };
    })
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // ── School-wide score distribution ───────────────────────────────────────
  const distAgg: Record<CbcScore, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
  for (const a of assessments)
    distAgg[a.score as CbcScore] = (distAgg[a.score as CbcScore] ?? 0) + 1;
  const distTotal = distAgg.EE + distAgg.ME + distAgg.AE + distAgg.BE;
  const scoreDistribution = (["EE", "ME", "AE", "BE"] as const).map((s) => ({
    score: s,
    count: distAgg[s],
    percent: distTotal > 0 ? Math.round((distAgg[s] / distTotal) * 100) : 0,
  }));

  // ── Term comparison chart (all 3 terms, this year) ────────────────────────
  const termMeans: Record<string, Record<number, number>> = {};
  for (const t of [1, 2, 3] as const) {
    const ta = allAssessments.filter((a) => a.term === t);
    const gBuckets: Record<string, Record<CbcScore, number>> = {};
    for (const a of ta) {
      const grade = studentMap[a.student_id]?.grade;
      if (!grade) continue;
      if (!gBuckets[grade]) gBuckets[grade] = { EE: 0, ME: 0, AE: 0, BE: 0 };
      const sc = gBuckets[grade]!;
      sc[a.score as CbcScore] = (sc[a.score as CbcScore] ?? 0) + 1;
    }
    for (const [grade, sc] of Object.entries(gBuckets)) {
      if (!termMeans[grade]) termMeans[grade] = {};
      termMeans[grade]![t] = wm(sc.EE, sc.ME, sc.AE, sc.BE);
    }
  }

  const termComparison: TermComparisonRow[] = uniqueGrades
    .filter((g) => enrollMap[g])
    .map((g) => {
      const t1 = termMeans[g]?.[1] ?? 0;
      const t2 = termMeans[g]?.[2] ?? 0;
      const t3 = termMeans[g]?.[3] ?? 0;
      // delta = improvement from first available term to latest available
      const vals = [t1, t2, t3].filter((v) => v > 0);
      const delta =
        vals.length >= 2 ? +(vals[vals.length - 1]! - vals[0]!).toFixed(2) : 0;
      return {
        grade: g,
        level: GRADE_LEVEL_MAP[g] ?? "lower_primary",
        t1,
        t2,
        t3,
        delta,
      };
    });

  // ── Attendance by grade ───────────────────────────────────────────────────
  const attMap: Record<
    string,
    { present: number; absent: number; late: number; total: number }
  > = {};
  for (const row of attendanceRows) {
    const grade = studentMap[row.student_id]?.grade;
    if (!grade) continue;
    if (!attMap[grade])
      attMap[grade] = { present: 0, absent: 0, late: 0, total: 0 };
    attMap[grade]!.total++;
    if (row.status === "present") attMap[grade]!.present++;
    else if (row.status === "absent") attMap[grade]!.absent++;
    else if (row.status === "late") attMap[grade]!.late++;
  }

  const attendanceByGrade: AttendanceSnapshot[] = uniqueGrades
    .filter((g) => attMap[g])
    .map((g) => ({
      grade: g,
      level: GRADE_LEVEL_MAP[g] ?? "lower_primary",
      totalRecords: attMap[g]!.total,
      presentCount: attMap[g]!.present,
      absentCount: attMap[g]!.absent,
      lateCount: attMap[g]!.late,
      rate:
        attMap[g]!.total > 0
          ? Math.round((attMap[g]!.present / attMap[g]!.total) * 100)
          : 0,
    }));

  // ── Admissions trend (last 6 months) ─────────────────────────────────────
  const now = new Date();
  const monthSlots = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: d.toLocaleDateString("en-KE", { month: "short" }),
    };
  });
  const admMap: Record<string, number> = {};
  for (const s of students) {
    const d = new Date(s.created_at);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    admMap[k] = (admMap[k] ?? 0) + 1;
  }
  const admissionsTrend = monthSlots.map(({ key, month }) => ({
    month,
    count: admMap[key] ?? 0,
  }));

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const assessedIds = new Set(assessments.map((a) => a.student_id));
  const coverageRate =
    students.length > 0
      ? Math.round((assessedIds.size / students.length) * 100)
      : 0;
  const avgMean =
    studentSummaries.length > 0
      ? +(
          studentSummaries.reduce((s, x) => s + x.weightedMean, 0) /
          studentSummaries.length
        ).toFixed(2)
      : 0;

  return {
    totalStudents: students.length,
    totalTeachers,
    totalAssessments: assessments.length,
    term,
    academicYear,
    coverageRate,
    avgMean,
    gradeSnapshots,
    subjectSnapshots,
    topPerformers: studentSummaries.slice(0, 15),
    needsSupport: [...studentSummaries].reverse().slice(0, 15),
    scoreDistribution,
    subjectLeaderboard,
    gradeEnrollment,
    termComparison,
    attendanceByGrade,
    admissionsTrend,
  };
}

// ── Grade drill-down ──────────────────────────────────────────────────────────

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
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("assessments")
      .select("id, student_id, subject_name, score")
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
      score: string;
    }[]
  ).filter((a) => studentIds.has(a.student_id));

  const subjectScores: Record<string, Record<CbcScore, number>> = {};
  for (const a of assessments) {
    if (!subjectScores[a.subject_name])
      subjectScores[a.subject_name] = { EE: 0, ME: 0, AE: 0, BE: 0 };
    const sc = subjectScores[a.subject_name]!;
    sc[a.score as CbcScore] = (sc[a.score as CbcScore] ?? 0) + 1;
  }

  const subjects: SubjectSnapshot[] = Object.entries(subjectScores)
    .map(([subjectName, sc]) => {
      const ee = sc.EE,
        me = sc.ME,
        ae = sc.AE,
        be = sc.BE;
      const total = ee + me + ae + be;
      return {
        subjectName,
        grade,
        eeCount: ee,
        meCount: me,
        aeCount: ae,
        beCount: be,
        total,
        weightedMean: wm(ee, me, ae, be),
        eePercent: total > 0 ? Math.round((ee / total) * 100) : 0,
        mePercent: total > 0 ? Math.round((me / total) * 100) : 0,
        aePercent: total > 0 ? Math.round((ae / total) * 100) : 0,
        bePercent: total > 0 ? Math.round((be / total) * 100) : 0,
      };
    })
    .sort((a, b) => b.weightedMean - a.weightedMean);

  const studentScores: Record<string, Record<CbcScore, number>> = {};
  for (const a of assessments) {
    if (!studentScores[a.student_id])
      studentScores[a.student_id] = { EE: 0, ME: 0, AE: 0, BE: 0 };
    const sc = studentScores[a.student_id]!;
    sc[a.score as CbcScore] = (sc[a.score as CbcScore] ?? 0) + 1;
  }

  const studentSummaries: StudentPerformanceSummary[] = students
    .map((s) => {
      const sc = studentScores[s.id] ?? { EE: 0, ME: 0, AE: 0, BE: 0 };
      const ee = sc.EE,
        me = sc.ME,
        ae = sc.AE,
        be = sc.BE;
      const total = ee + me + ae + be;
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
        weightedMean: wm(ee, me, ae, be),
        dominantScore: dominant,
      };
    })
    .sort((a, b) => b.weightedMean - a.weightedMean);

  const distAgg: Record<CbcScore, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
  for (const a of assessments)
    distAgg[a.score as CbcScore] = (distAgg[a.score as CbcScore] ?? 0) + 1;
  const distTotal = distAgg.EE + distAgg.ME + distAgg.AE + distAgg.BE;
  const scoreDistribution = (["EE", "ME", "AE", "BE"] as const).map((s) => ({
    score: s,
    count: distAgg[s],
    percent: distTotal > 0 ? Math.round((distAgg[s] / distTotal) * 100) : 0,
  }));

  return { grade, subjects, students: studentSummaries, scoreDistribution };
}
