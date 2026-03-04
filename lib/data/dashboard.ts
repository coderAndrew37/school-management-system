import { createServerClient } from "@/lib/supabase/client";
import {
  Student,
  Teacher,
  DashboardStats,
  Parent,
} from "@/lib/types/dashboard";
import { ALL_GRADES } from "@/lib/types/allocation";
import { GRADE_LEVEL_MAP } from "@/lib/types/assessment";

function mapStudentRow(row: any): Student {
  return {
    ...row,
    parents: Array.isArray(row.parents)
      ? row.parents[0] || null
      : row.parents || null,
  };
}

export async function fetchStudents(limit?: number): Promise<Student[]> {
  const supabase = createServerClient();
  let query = supabase
    .from("students")
    .select(
      `id, readable_id, upi_number, full_name, date_of_birth,
      gender, current_grade, parent_id, created_at,
      parents ( full_name, phone_number )`,
    )
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) {
    console.error("fetchStudents error:", error);
    return [];
  }
  return (data ?? []).map(mapStudentRow);
}

export async function fetchAllStudents({
  search = "",
  grade = "",
  gender = "",
  sortBy = "created_at",
  sortDir = "desc",
}: {
  search?: string;
  grade?: string;
  gender?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
} = {}): Promise<Student[]> {
  const supabase = createServerClient();
  let query = supabase
    .from("students")
    .select(
      `id, readable_id, upi_number, full_name, date_of_birth,
      gender, current_grade, parent_id, created_at,
      parents ( full_name, phone_number )`,
    )
    .order(sortBy, { ascending: sortDir === "asc" });
  if (search)
    query = query.or(
      `full_name.ilike.%${search}%,readable_id.ilike.%${search}%`,
    );
  if (grade) query = query.eq("current_grade", grade);
  if (gender) query = query.eq("gender", gender);
  const { data, error } = await query;
  if (error) {
    console.error("fetchAllStudents error:", error);
    return [];
  }
  return (data ?? []).map(mapStudentRow);
}

export async function fetchTeachers(): Promise<Teacher[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, tsc_number, email, phone_number, created_at")
    .order("full_name", { ascending: true });
  if (error) {
    console.error("fetchTeachers error:", error);
    return [];
  }
  return (data ?? []) as Teacher[];
}

export async function fetchParents(): Promise<Parent[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("parents")
    .select("id, full_name, email, phone_number, created_at")
    .order("full_name", { ascending: true });
  if (error) {
    console.error("fetchParents error:", error);
    return [];
  }
  return (data ?? []) as Parent[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = createServerClient();
  const [studentsCount, teachersCount, parentsCount] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("teachers").select("id", { count: "exact", head: true }),
    supabase.from("parents").select("id", { count: "exact", head: true }),
  ]);
  return {
    totalStudents: studentsCount.count ?? 0,
    totalTeachers: teachersCount.count ?? 0,
    totalParents: parentsCount.count ?? 0,
  };
}

// ── Chart data types ──────────────────────────────────────────────────────────

export interface GradeEnrollmentBar {
  grade: string;
  count: number;
  level: string;
  male: number;
  female: number;
}
export interface LevelSummary {
  level: string;
  label: string;
  count: number;
  color: string;
}
export interface ScoreDistItem {
  score: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}
export interface RecentAdmission {
  month: string;
  count: number;
}
export interface DashboardChartData {
  gradeEnrollment: GradeEnrollmentBar[];
  levelSummary: LevelSummary[];
  genderSplit: { male: number; female: number; unknown: number };
  scoreDistribution: ScoreDistItem[];
  assessmentTotals: { total: number; assessed: number; unassessed: number };
  recentAdmissions: RecentAdmission[];
}

const LEVEL_META: Record<string, { label: string; color: string }> = {
  lower_primary: { label: "Lower Primary", color: "#f59e0b" },
  upper_primary: { label: "Upper Primary", color: "#38bdf8" },
  junior_secondary: { label: "Junior Secondary", color: "#34d399" },
};

const SCORE_META: Record<string, { label: string; color: string }> = {
  EE: { label: "Exceeds Expectation", color: "#34d399" },
  ME: { label: "Meets Expectation", color: "#38bdf8" },
  AE: { label: "Approaching", color: "#f59e0b" },
  BE: { label: "Below Expectation", color: "#fb7185" },
};

export async function fetchDashboardChartData(
  term = 1,
  academicYear = 2026,
): Promise<DashboardChartData> {
  const supabase = createServerClient();

  const [studentsRes, assessRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, current_grade, gender, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("assessments")
      .select("student_id, score")
      .eq("term", term)
      .eq("academic_year", academicYear)
      .not("score", "is", null),
  ]);

  const students = (studentsRes.data ?? []) as {
    id: string;
    current_grade: string;
    gender: string | null;
    created_at: string;
  }[];
  const assessments = (assessRes.data ?? []) as {
    student_id: string;
    score: string;
  }[];

  // Grade enrollment
  const gradeMap: Record<
    string,
    { male: number; female: number; total: number }
  > = {};
  for (const s of students) {
    const g = s.current_grade;
    if (!gradeMap[g]) gradeMap[g] = { male: 0, female: 0, total: 0 };
    gradeMap[g]!.total++;
    if (s.gender === "Male") gradeMap[g]!.male++;
    if (s.gender === "Female") gradeMap[g]!.female++;
  }
  const gradeEnrollment: GradeEnrollmentBar[] = ALL_GRADES.filter(
    (g) => gradeMap[g],
  ).map((g) => ({
    grade: g,
    count: gradeMap[g]!.total,
    level: GRADE_LEVEL_MAP[g] ?? "lower_primary",
    male: gradeMap[g]!.male,
    female: gradeMap[g]!.female,
  }));

  // Level summary
  const levelCount: Record<string, number> = {};
  for (const row of gradeEnrollment)
    levelCount[row.level] = (levelCount[row.level] ?? 0) + row.count;
  const levelSummary: LevelSummary[] = Object.entries(levelCount).map(
    ([level, count]) => ({
      level,
      count,
      label: LEVEL_META[level]?.label ?? level,
      color: LEVEL_META[level]?.color ?? "#f59e0b",
    }),
  );

  // Gender split
  const male = students.filter((s) => s.gender === "Male").length;
  const female = students.filter((s) => s.gender === "Female").length;
  const unknown = students.length - male - female;

  // Score distribution
  const scoreCounts: Record<string, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };
  for (const a of assessments) {
    if (scoreCounts[a.score] !== undefined) scoreCounts[a.score]!++;
  }
  const scoreTotal = assessments.length;
  const scoreDistribution: ScoreDistItem[] = (
    ["EE", "ME", "AE", "BE"] as const
  ).map((s) => ({
    score: s,
    label: SCORE_META[s]!.label,
    count: scoreCounts[s]!,
    percent:
      scoreTotal > 0 ? Math.round((scoreCounts[s]! / scoreTotal) * 100) : 0,
    color: SCORE_META[s]!.color,
  }));

  // Assessment totals
  const assessedStudentIds = new Set(assessments.map((a) => a.student_id));
  const assessmentTotals = {
    total: students.length,
    assessed: assessedStudentIds.size,
    unassessed: students.length - assessedStudentIds.size,
  };

  // Recent admissions — last 6 months
  const now = new Date();
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: d.toLocaleDateString("en-KE", { month: "short" }),
    };
  });
  const admissionsPerMonth: Record<string, number> = {};
  for (const s of students) {
    const d = new Date(s.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    admissionsPerMonth[key] = (admissionsPerMonth[key] ?? 0) + 1;
  }
  const recentAdmissions: RecentAdmission[] = monthLabels.map(
    ({ key, month }) => ({
      month,
      count: admissionsPerMonth[key] ?? 0,
    }),
  );

  return {
    gradeEnrollment,
    levelSummary,
    genderSplit: { male, female, unknown },
    scoreDistribution,
    assessmentTotals,
    recentAdmissions,
  };
}
