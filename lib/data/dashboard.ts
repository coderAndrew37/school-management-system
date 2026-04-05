import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ALL_GRADES } from "@/lib/types/allocation";
import { GRADE_LEVEL_MAP } from "@/lib/types/assessment";
import { DashboardStats, Student } from "@/lib/types/dashboard";

// ── Helper: Map Student Join Table ───────────────────────────────────────────
/**
 * Flattens the join table student_parents into the shape the frontend expects.
 * Prioritizes the primary contact for the summary 'parents' field.
 */
function mapStudentRow(row: any): Student {
  const links: any[] = Array.isArray(row.student_parents)
    ? row.student_parents
    : [];
  const primary = links.find((l) => l.is_primary_contact) ?? links[0] ?? null;

  return {
    ...row,
    parents: primary?.parents ?? null,
    parent_id: null,
    status: row.status ?? "active",
    all_parents: links.map((l: any) => ({
      parent_id: l.parents?.id ?? "",
      full_name: l.parents?.full_name ?? "",
      phone_number: l.parents?.phone_number ?? null,
      email: l.parents?.email ?? "",
      relationship_type: l.relationship_type,
      is_primary_contact: l.is_primary_contact,
      invite_accepted: l.parents?.invite_accepted ?? false,
    })),
  };
}

const STUDENT_SELECT = `
  id, readable_id, upi_number, full_name,
  date_of_birth, gender, current_grade, photo_url, status, created_at,
  student_parents (
    is_primary_contact,
    relationship_type,
    parents ( id, full_name, phone_number, email, invite_accepted )
  )
` as const;

// ── Student Fetchers ──────────────────────────────────────────────────────────

export async function fetchStudents(limit?: number): Promise<Student[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("students")
    .select(STUDENT_SELECT)
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error("[fetchStudents] error:", error.message);
    return [];
  }
  return (data ?? []).map(mapStudentRow);
}

export async function fetchAllStudents({
  search = "",
  grade = "",
  gender = "",
  status = "active",
  sortBy = "created_at",
  sortDir = "desc",
}: {
  search?: string;
  grade?: string;
  gender?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
} = {}): Promise<Student[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("students")
    .select(STUDENT_SELECT)
    .order(sortBy, { ascending: sortDir === "asc" });

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,readable_id.ilike.%${search}%`,
    );
  }
  if (grade) query = query.eq("current_grade", grade);
  if (gender) query = query.eq("gender", gender);
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[fetchAllStudents] error:", error.message);
    return [];
  }
  return (data ?? []).map(mapStudentRow);
}

// ── Dashboard Stats ───────────────────────────────────────────────────────────

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = await createSupabaseServerClient();
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

// ── Chart Data Types & Metadata ───────────────────────────────────────────────

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

// ── Dashboard Analytics ───────────────────────────────────────────────────────

export async function fetchDashboardChartData(
  term = 1,
  academicYear = 2026,
): Promise<DashboardChartData> {
  const supabase = await createSupabaseServerClient();

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

  // 1. Grade Enrollment logic
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

  // 2. Level Summary logic
  const levelCount: Record<string, number> = {};
  for (const row of gradeEnrollment) {
    levelCount[row.level] = (levelCount[row.level] ?? 0) + row.count;
  }
  const levelSummary: LevelSummary[] = Object.entries(levelCount).map(
    ([level, count]) => ({
      level,
      count,
      label: LEVEL_META[level]?.label ?? level,
      color: LEVEL_META[level]?.color ?? "#f59e0b",
    }),
  );

  // 3. Gender split
  const male = students.filter((s) => s.gender === "Male").length;
  const female = students.filter((s) => s.gender === "Female").length;
  const unknown = students.length - male - female;

  // 4. Score distribution
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

  // 5. Assessment totals
  const assessedStudentIds = new Set(assessments.map((a) => a.student_id));
  const assessmentTotals = {
    total: students.length,
    assessed: assessedStudentIds.size,
    unassessed: students.length - assessedStudentIds.size,
  };

  // 6. Recent admissions (KE Locale)
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
