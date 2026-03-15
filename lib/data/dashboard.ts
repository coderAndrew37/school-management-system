import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Student,
  Teacher,
  DashboardStats,
  Parent,
} from "@/lib/types/dashboard";
import { ALL_GRADES } from "@/lib/types/allocation";
import { GRADE_LEVEL_MAP } from "@/lib/types/assessment";

// ── Helper: flatten the join table into the shape the rest of the
//    app expects — student.parents = { full_name, phone_number } | null
// ─────────────────────────────────────────────────────────────────────────────
function mapStudentRow(row: any): Student {
  // student_parents is an array of join rows, each with a nested `parents` obj.
  // We pick the primary contact first, then fall back to the first entry.
  const links: any[] = Array.isArray(row.student_parents)
    ? row.student_parents
    : [];
  const primary = links.find((l) => l.is_primary_contact) ?? links[0] ?? null;

  return {
    ...row,
    // Expose the parent object at row.parents so every consumer that
    // already reads student.parents keeps working without changes.
    parents: primary?.parents ?? null,
    // parent_id is gone from the DB — set to null so TypeScript is happy
    // if any consumer still references it.
    parent_id: null,
  };
}

// Select fragment — joins through student_parents → parents
const STUDENT_SELECT = `
  id, readable_id, upi_number, full_name,
  date_of_birth, gender, current_grade, photo_url, created_at,
  student_parents (
    is_primary_contact,
    relationship_type,
    parents ( id, full_name, phone_number )
  )
` as const;

// ── fetchStudents ─────────────────────────────────────────────────────────────

export async function fetchStudents(limit?: number): Promise<Student[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("students")
    .select(STUDENT_SELECT)
    .order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) {
    console.error("fetchStudents error:", error);
    return [];
  }
  return (data ?? []).map(mapStudentRow);
}

// ── fetchAllStudents ──────────────────────────────────────────────────────────

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
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("students")
    .select(STUDENT_SELECT)
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

// ── fetchTeachers ─────────────────────────────────────────────────────────────

export async function fetchTeachers(): Promise<Teacher[]> {
  const supabase = await createSupabaseServerClient();
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

// ── fetchParents ──────────────────────────────────────────────────────────────

export async function fetchParents(): Promise<Parent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("parents")
    .select(
      `id, full_name, email, phone_number, created_at,
      student_parents (
        students ( id, full_name, current_grade )
      )`,
    )
    .order("full_name", { ascending: true });
  if (error) {
    console.error("fetchParents error:", error);
    return [];
  }
  // Flatten children onto each parent for convenient access in the UI
  return (data ?? []).map((p: any) => ({
    ...p,
    children: (p.student_parents ?? [])
      .map((sp: any) => sp.students)
      .filter(Boolean),
  })) as Parent[];
}

// ── fetchDashboardStats ───────────────────────────────────────────────────────

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

// ── fetchDashboardChartData ───────────────────────────────────────────────────
// No parent join here — this function only needs student demographic data
// and assessment scores, so it was already correct. No changes needed.

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
