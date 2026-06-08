// lib/data/analytics.ts
//
// Multi-tenant analytics pipeline for a CBC school management system.
//
// Design principles
// ─────────────────
// 1. Every DB query carries an explicit `.eq("school_id", schoolId)` — no
//    row can leak across tenant boundaries even if RLS is misconfigured.
// 2. N/A and null scores are rejected at the DB tier (.not / .neq) AND via
//    a runtime type guard before any score bucket is incremented — two walls.
// 3. `fetchGradeAnalytics` uses `.in("student_id", ids)` so only that grade's
//    assessments cross the wire, not the full school's.
// 4. The three-term comparison is built in a single pass over `allAssessments`
//    rather than three filtered re-scans.
// 5. `subjects` table is fetched directly so `totalSubjects` and subject
//    metadata are always accurate, even before any assessments exist.
//    The leaderboard seeds from this table so every subject appears even
//    at zero assessments.
// 6. All inline `as { ... }[]` casts replaced by typed interfaces.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GRADE_LEVEL_MAP } from "@/lib/types/assessment";

// ── Score constants ───────────────────────────────────────────────────────────

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

const VALID_SCORES = ["EE", "ME", "AE", "BE"] as const;
type CbcScore = (typeof VALID_SCORES)[number];

/** Rejects null, "N/A", and any unexpected string at runtime. */
function isValidScore(s: string | null | undefined): s is CbcScore {
  return VALID_SCORES.includes(s as CbcScore);
}

// ── Weighted mean ─────────────────────────────────────────────────────────────

function weightedMean(ee: number, me: number, ae: number, be: number): number {
  const total = ee + me + ae + be;
  return total > 0
    ? +((ee * 4 + me * 3 + ae * 2 + be * 1) / total).toFixed(2)
    : 0;
}

// ── Score bucket ──────────────────────────────────────────────────────────────

type ScoreBucket = Record<CbcScore, number>;

function emptyBucket(): ScoreBucket {
  return { EE: 0, ME: 0, AE: 0, BE: 0 };
}

function bucketMean(b: ScoreBucket): number {
  return weightedMean(b.EE, b.ME, b.AE, b.BE);
}

// ── Raw DB row types ──────────────────────────────────────────────────────────

interface RawStudent {
  id: string;
  full_name: string;
  readable_id: string | null;
  current_grade: string;
  gender: string | null;
  created_at: string;
}

interface RawAssessment {
  id: string;
  student_id: string;
  subject_name: string;
  score: string | null;
  term: number;
}

interface RawAttendance {
  student_id: string;
  status: string;
}

// Matches the subjects table schema exactly.
interface RawSubject {
  id: string;
  name: string;
  code: string;
  level: string;
  weekly_lessons: number;
  knec_learning_area: string | null;
}

// ── Exported types ────────────────────────────────────────────────────────────

export interface SubjectRecord {
  id: string;
  name: string;
  code: string;
  level: string;
  weeklyLessons: number;
  knecLearningArea: string | null;
}

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
  coverageRate: number;
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
  t1: number;
  t2: number;
  t3: number;
  delta: number;
}

export interface AttendanceSnapshot {
  grade: string;
  level: string;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  rate: number;
}

export interface AnalyticsOverview {
  totalStudents: number;
  totalTeachers: number;
  totalAssessments: number;
  // Sourced directly from the subjects table — accurate even with zero assessments
  totalSubjects: number;
  subjects: SubjectRecord[];
  term: number;
  academicYear: number;
  coverageRate: number;
  avgMean: number;
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
  admissionsTrend: { month: string; count: number }[];
}

// ── Builder helpers ───────────────────────────────────────────────────────────

function buildStudentSummary(
  student: Pick<RawStudent, "id" | "full_name" | "readable_id" | "current_grade">,
  bucket: ScoreBucket,
): StudentPerformanceSummary {
  const { EE: ee, ME: me, AE: ae, BE: be } = bucket;
  const totalAssessed = ee + me + ae + be;
  const dominantScore: CbcScore | null =
    totalAssessed > 0
      ? VALID_SCORES.reduce((best, cur) =>
          bucket[cur] > bucket[best] ? cur : best,
        )
      : null;
  return {
    studentId:     student.id,
    fullName:      student.full_name,
    readableId:    student.readable_id,
    grade:         student.current_grade,
    eeCount:       ee,
    meCount:       me,
    aeCount:       ae,
    beCount:       be,
    totalAssessed,
    weightedMean:  weightedMean(ee, me, ae, be),
    dominantScore,
  };
}

function buildSubjectSnapshot(
  subjectName: string,
  grade: string,
  sc: ScoreBucket,
): SubjectSnapshot {
  const { EE: ee, ME: me, AE: ae, BE: be } = sc;
  const total = ee + me + ae + be;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return {
    subjectName,
    grade,
    eeCount:      ee,
    meCount:      me,
    aeCount:      ae,
    beCount:      be,
    total,
    weightedMean: weightedMean(ee, me, ae, be),
    eePercent:    pct(ee),
    mePercent:    pct(me),
    aePercent:    pct(ae),
    bePercent:    pct(be),
  };
}

// ── Main overview fetch ───────────────────────────────────────────────────────

export async function fetchAnalyticsOverview(
  schoolId: string,
  term = 1,
  academicYear = 2026,
): Promise<AnalyticsOverview> {
  const supabase = await createSupabaseServerClient();

  // Five parallel queries — every one explicitly scoped to schoolId.
  const [
    studentsRes,
    teachersRes,
    assessAllTermsRes,
    attendanceRes,
    subjectsRes,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, readable_id, current_grade, gender, created_at")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("full_name"),

    // Count only — no row data, no full scan.
    supabase
      .from("teachers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .eq("status", "active"),

    // All three terms in one round-trip for the term-comparison chart.
    // N/A and null rejected at DB tier (wall 1).
    supabase
      .from("assessments")
      .select("id, student_id, subject_name, score, term")
      .eq("school_id", schoolId)
      .eq("academic_year", academicYear)
      .not("score", "is", null)
      .neq("score", "N/A"),

    supabase
      .from("attendance")
      .select("student_id, status")
      .eq("school_id", schoolId)
      .eq("academic_year", academicYear)
      .eq("term", term),

    // Subjects table — authoritative source for subject count and metadata.
    // assessment.subject_name alone can't surface subjects with no assessments yet.
    supabase
      .from("subjects")
      .select("id, name, code, level, weekly_lessons, knec_learning_area")
      .eq("school_id", schoolId)
      .order("name"),
  ]);

  // ── Type-safe extraction ──────────────────────────────────────────────────

  const students       = (studentsRes.data       ?? []) as RawStudent[];
  const totalTeachers  = teachersRes.count        ?? 0;
  const allAssessments = (assessAllTermsRes.data  ?? []) as RawAssessment[];
  const attendanceRows = (attendanceRes.data      ?? []) as RawAttendance[];
  const rawSubjects    = (subjectsRes.data        ?? []) as RawSubject[];

  // Shape subjects into the exported type.
  const subjects: SubjectRecord[] = rawSubjects.map((s) => ({
    id:               s.id,
    name:             s.name,
    code:             s.code,
    level:            s.level,
    weeklyLessons:    s.weekly_lessons,
    knecLearningArea: s.knec_learning_area,
  }));
  const totalSubjects = subjects.length;

  // Runtime wall 2: filter any score that slipped past the DB filter.
  const allValidAssessments = allAssessments.filter((a) => isValidScore(a.score));
  const assessments         = allValidAssessments.filter((a) => a.term === term);

  // ── Student lookup maps ───────────────────────────────────────────────────

  const studentMeta: Record<string, { grade: string; gender: string | null }> = {};
  const enrollMap:   Record<string, { total: number; male: number; female: number }> = {};

  for (const s of students) {
    studentMeta[s.id] = { grade: s.current_grade, gender: s.gender };
    if (!enrollMap[s.current_grade])
      enrollMap[s.current_grade] = { total: 0, male: 0, female: 0 };
    enrollMap[s.current_grade]!.total++;
    if (s.gender === "Male")   enrollMap[s.current_grade]!.male++;
    if (s.gender === "Female") enrollMap[s.current_grade]!.female++;
  }

  const uniqueGrades = Array.from(
    new Set(students.map((s) => s.current_grade)),
  ).sort();

  // ── Grade enrollment ──────────────────────────────────────────────────────

  const gradeEnrollment = uniqueGrades
    .filter((g) => enrollMap[g])
    .map((g) => ({
      grade:  g,
      count:  enrollMap[g]!.total,
      male:   enrollMap[g]!.male,
      female: enrollMap[g]!.female,
      level:  GRADE_LEVEL_MAP[g] ?? "lower_primary",
    }));

  // ── Single-pass score aggregation (current term) ──────────────────────────

  const gradeBuckets:   Record<string, ScoreBucket> = {};
  const gradeAssessed:  Record<string, Set<string>> = {};
  const subjectBuckets: Record<string, ScoreBucket> = {};
  const studentBuckets: Record<string, ScoreBucket> = {};

  for (const a of assessments) {
    const score = a.score as CbcScore;
    const grade = studentMeta[a.student_id]?.grade;
    if (!grade) continue;

    if (!gradeBuckets[grade])  gradeBuckets[grade]  = emptyBucket();
    gradeBuckets[grade]![score]++;

    if (!gradeAssessed[grade]) gradeAssessed[grade] = new Set();
    gradeAssessed[grade]!.add(a.student_id);

    const subKey = `${a.subject_name}__${grade}`;
    if (!subjectBuckets[subKey]) subjectBuckets[subKey] = emptyBucket();
    subjectBuckets[subKey]![score]++;

    if (!studentBuckets[a.student_id]) studentBuckets[a.student_id] = emptyBucket();
    studentBuckets[a.student_id]![score]++;
  }

  // ── Term comparison — single pass over all three terms ───────────────────

  const termGradeBuckets: Record<number, Record<string, ScoreBucket>> = {
    1: {}, 2: {}, 3: {},
  };

  for (const a of allValidAssessments) {
    const score = a.score as CbcScore;
    const grade = studentMeta[a.student_id]?.grade;
    if (!grade || !(a.term in termGradeBuckets)) continue;
    const tb = termGradeBuckets[a.term as 1 | 2 | 3]!;
    if (!tb[grade]) tb[grade] = emptyBucket();
    tb[grade]![score]++;
  }

  const termComparison: TermComparisonRow[] = uniqueGrades
    .filter((g) => enrollMap[g])
    .map((g) => {
      const t1 = bucketMean(termGradeBuckets[1]![g] ?? emptyBucket());
      const t2 = bucketMean(termGradeBuckets[2]![g] ?? emptyBucket());
      const t3 = bucketMean(termGradeBuckets[3]![g] ?? emptyBucket());
      const vals = [t1, t2, t3].filter((v) => v > 0);
      const delta =
        vals.length >= 2 ? +(vals[vals.length - 1]! - vals[0]!).toFixed(2) : 0;
      return { grade: g, level: GRADE_LEVEL_MAP[g] ?? "lower_primary", t1, t2, t3, delta };
    });

  // ── Grade snapshots ───────────────────────────────────────────────────────

  const gradeSnapshots: GradeSnapshot[] = uniqueGrades
    .filter((g) => enrollMap[g])
    .map((g) => {
      const b             = gradeBuckets[g] ?? emptyBucket();
      const enrolled      = enrollMap[g]!.total;
      const assessedCount = gradeAssessed[g]?.size ?? 0;
      return {
        grade:        g,
        level:        GRADE_LEVEL_MAP[g] ?? "lower_primary",
        studentCount: enrolled,
        assessedCount,
        male:         enrollMap[g]!.male,
        female:       enrollMap[g]!.female,
        eeCount:      b.EE,
        meCount:      b.ME,
        aeCount:      b.AE,
        beCount:      b.BE,
        totalScores:  b.EE + b.ME + b.AE + b.BE,
        weightedMean: bucketMean(b),
        coverageRate: enrolled > 0 ? Math.round((assessedCount / enrolled) * 100) : 0,
      };
    });

  // ── Subject snapshots ─────────────────────────────────────────────────────

  const subjectSnapshots: SubjectSnapshot[] = Object.entries(subjectBuckets)
    .map(([key, sc]) => {
      const [subjectName, grade] = key.split("__") as [string, string];
      return buildSubjectSnapshot(subjectName, grade, sc);
    })
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // ── Subject leaderboard ───────────────────────────────────────────────────
  //
  // Seed with every subject from the subjects table at zero so the count is
  // always correct, even before any assessment data exists.
  // Assessment data from subjectSnapshots is layered on top.

  const subjectAgg: Record<string, { total: number; weightedSum: number }> = {};

  for (const s of subjects) {
    subjectAgg[s.name] = { total: 0, weightedSum: 0 };
  }

  for (const ss of subjectSnapshots) {
    if (!subjectAgg[ss.subjectName]) {
      // Assessment references a name not in subjects table — include it anyway.
      subjectAgg[ss.subjectName] = { total: 0, weightedSum: 0 };
    }
    subjectAgg[ss.subjectName]!.total       += ss.total;
    subjectAgg[ss.subjectName]!.weightedSum += ss.weightedMean * ss.total;
  }

  const subjectLeaderboard = Object.entries(subjectAgg)
    .map(([subjectName, v]) => ({
      subjectName,
      total:        v.total,
      weightedMean: v.total > 0 ? +(v.weightedSum / v.total).toFixed(2) : 0,
    }))
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // ── Student summaries ─────────────────────────────────────────────────────

  const studentSummaries: StudentPerformanceSummary[] = students
    .filter((s) => studentBuckets[s.id])
    .map((s) => buildStudentSummary(s, studentBuckets[s.id]!))
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // ── School-wide score distribution ───────────────────────────────────────

  const distAgg = emptyBucket();
  for (const a of assessments) distAgg[a.score as CbcScore]++;
  const distTotal = distAgg.EE + distAgg.ME + distAgg.AE + distAgg.BE;
  const scoreDistribution = VALID_SCORES.map((s) => ({
    score:   s,
    count:   distAgg[s],
    percent: distTotal > 0 ? Math.round((distAgg[s] / distTotal) * 100) : 0,
  }));

  // ── Attendance by grade ───────────────────────────────────────────────────

  const attMap: Record<
    string,
    { present: number; absent: number; late: number; total: number }
  > = {};

  for (const row of attendanceRows) {
    const grade = studentMeta[row.student_id]?.grade;
    if (!grade) continue;
    if (!attMap[grade]) attMap[grade] = { present: 0, absent: 0, late: 0, total: 0 };
    attMap[grade]!.total++;
    if      (row.status === "present") attMap[grade]!.present++;
    else if (row.status === "absent")  attMap[grade]!.absent++;
    else if (row.status === "late")    attMap[grade]!.late++;
  }

  const attendanceByGrade: AttendanceSnapshot[] = uniqueGrades
    .filter((g) => attMap[g])
    .map((g) => ({
      grade:        g,
      level:        GRADE_LEVEL_MAP[g] ?? "lower_primary",
      totalRecords: attMap[g]!.total,
      presentCount: attMap[g]!.present,
      absentCount:  attMap[g]!.absent,
      lateCount:    attMap[g]!.late,
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
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
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
    totalStudents:    students.length,
    totalTeachers,
    totalAssessments: assessments.length,
    totalSubjects,
    subjects,
    term,
    academicYear,
    coverageRate,
    avgMean,
    gradeSnapshots,
    subjectSnapshots,
    topPerformers:    studentSummaries.slice(0, 15),
    needsSupport:     [...studentSummaries].reverse().slice(0, 15),
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
  schoolId: string,
  grade: string,
  term = 1,
  academicYear = 2026,
): Promise<GradeAnalyticsDetail> {
  const supabase = await createSupabaseServerClient();

  // Step 1: students in this grade for this school only.
  const { data: studentRows, error: studentError } = await supabase
    .from("students")
    .select("id, full_name, readable_id, current_grade")
    .eq("school_id", schoolId)
    .eq("current_grade", grade)
    .eq("status", "active")
    .order("full_name");

  if (studentError) {
    console.error("[fetchGradeAnalytics] students:", studentError.message);
  }

  const students = (studentRows ?? []) as Pick<
    RawStudent,
    "id" | "full_name" | "readable_id" | "current_grade"
  >[];

  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return {
      grade,
      subjects: [],
      students: [],
      scoreDistribution: VALID_SCORES.map((s) => ({ score: s, count: 0, percent: 0 })),
    };
  }

  // Step 2: only those students' assessments — school_id is a second guard.
  const { data: assessRows, error: assessError } = await supabase
    .from("assessments")
    .select("id, student_id, subject_name, score, term")
    .eq("school_id", schoolId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .in("student_id", studentIds)
    .not("score", "is", null)
    .neq("score", "N/A");

  if (assessError) {
    console.error("[fetchGradeAnalytics] assessments:", assessError.message);
  }

  // Runtime wall 2.
  const assessments = ((assessRows ?? []) as RawAssessment[]).filter((a) =>
    isValidScore(a.score),
  );

  // ── Single-pass aggregation ───────────────────────────────────────────────

  const subjectBuckets: Record<string, ScoreBucket> = {};
  const studentBuckets: Record<string, ScoreBucket> = {};

  for (const a of assessments) {
    const score = a.score as CbcScore;
    if (!subjectBuckets[a.subject_name]) subjectBuckets[a.subject_name] = emptyBucket();
    subjectBuckets[a.subject_name]![score]++;
    if (!studentBuckets[a.student_id])  studentBuckets[a.student_id]  = emptyBucket();
    studentBuckets[a.student_id]![score]++;
  }

  const subjects: SubjectSnapshot[] = Object.entries(subjectBuckets)
    .map(([subjectName, sc]) => buildSubjectSnapshot(subjectName, grade, sc))
    .sort((a, b) => b.weightedMean - a.weightedMean);

  // Include ALL students — even those with zero assessments.
  const studentSummaries: StudentPerformanceSummary[] = students
    .map((s) => buildStudentSummary(s, studentBuckets[s.id] ?? emptyBucket()))
    .sort((a, b) => b.weightedMean - a.weightedMean);

  const distAgg = emptyBucket();
  for (const a of assessments) distAgg[a.score as CbcScore]++;
  const distTotal = distAgg.EE + distAgg.ME + distAgg.AE + distAgg.BE;

  const scoreDistribution = VALID_SCORES.map((s) => ({
    score:   s,
    count:   distAgg[s],
    percent: distTotal > 0 ? Math.round((distAgg[s] / distTotal) * 100) : 0,
  }));

  return { grade, subjects, students: studentSummaries, scoreDistribution };
}