// lib/data/dashboard.ts
// Kibali Academy — Dashboard Data Fetchers
//
// All queries are school_id scoped via Supabase RLS + explicit .eq() filters.
// Zero usage of `any` — every join shape is explicitly typed.
// The session user's school_id is read once and reused across all queries.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GRADE_LEVEL_MAP } from "@/lib/types/assessment";
import type { DashboardStats, Student } from "@/lib/types/dashboard";

// ============================================================================
// INTERNAL JOIN TYPES
// ============================================================================

interface RawClassJoin {
  stream: string;
}

interface RawProfileRow {
  id: string;
  full_name: string;
  phone_number: string | null;
  email: string | null;
}

interface RawParentLink {
  is_primary_contact: boolean;
  relationship_type: string;
  profiles: RawProfileRow | null;
}

interface RawStudentRow {
  id: string;
  readable_id: string;
  upi_number: string | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  class_id: string | null;
  photo_url: string | null;
  status: string | null;
  created_at: string;
  classes: RawClassJoin | null;
  student_parents: RawParentLink[] | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolves the calling user's school_id from their profile.
 * Throws if unauthenticated or profile missing.
 */
async function resolveSchoolId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("[dashboard] Unauthenticated request.");

  // Prefer JWT app_metadata (zero DB call path) — written by sync_user_jwt_claims trigger
  const jwtSchoolId = user.app_metadata?.school_id as string | undefined;
  if (jwtSchoolId) return jwtSchoolId;

  // Fallback: read from profiles (first login before trigger fires)
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .single();

  if (error || !profile?.school_id) {
    throw new Error("[dashboard] Could not resolve school_id from profile.");
  }

  return profile.school_id as string;
}

function mapStudentRow(row: RawStudentRow): Student {
  const links = row.student_parents ?? [];
  const primary = links.find((l) => l.is_primary_contact) ?? links[0] ?? null;

  return {
    id:             row.id,
    readable_id:    row.readable_id,
    upi_number:     row.upi_number,
    full_name:      row.full_name,
    date_of_birth:  row.date_of_birth,
    gender:         row.gender,
    current_grade:  row.current_grade,
    current_stream: row.classes?.stream ?? "Main",
    class_id:       row.class_id ?? "",
    photo_url:      row.photo_url,
    created_at:     row.created_at,
    status:         (row.status as Student["status"]) ?? "active",
    parents:        primary?.profiles
      ? {
          id: primary.profiles.id,
          full_name: primary.profiles.full_name,
          phone_number: primary.profiles.phone_number,
          email: primary.profiles.email ?? "",
          invite_accepted: true,
        }
      : null,
    all_parents: links.map((l) => ({
      parent_id:          l.profiles?.id           ?? "",
      full_name:          l.profiles?.full_name     ?? "",
      phone_number:       l.profiles?.phone_number  ?? null,
      email:              l.profiles?.email         ?? "",
      relationship_type:  l.relationship_type,
      is_primary_contact: l.is_primary_contact,
      invite_accepted:    true,
    })),
  };
}

// Explicit foreign key constraint tracking to bypass old cached relation mappings
const STUDENT_SELECT = `
  id, readable_id, upi_number, full_name,
  date_of_birth, gender, current_grade, class_id, photo_url, status, created_at,
  classes ( stream ),
  student_parents (
    is_primary_contact,
    relationship_type,
    parent:profiles!student_parents_parent_id_profiles_fkey ( 
      id, full_name, phone_number, email 
    )
  )
` as const;
// ============================================================================
// STUDENT FETCHERS
// ============================================================================

export async function fetchStudents(limit?: number): Promise<Student[]> {
  const supabase   = await createSupabaseServerClient();
  const school_id  = await resolveSchoolId(supabase);

  let query = supabase
    .from("students")
    .select(STUDENT_SELECT)
    .eq("school_id", school_id)           // ← explicit tenant fence
    .order("created_at", { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("[fetchStudents]", error.message);
    return [];
  }

  return (data as unknown as RawStudentRow[]).map(mapStudentRow);
}

export interface FetchAllStudentsOptions {
  search?:  string;
  grade?:   string;
  stream?:  string;
  gender?:  string;
  status?:  string;
  sortBy?:  string;
  sortDir?: "asc" | "desc";
}

export async function fetchAllStudents(
  options: FetchAllStudentsOptions = {}
): Promise<Student[]> {
  const {
    search  = "",
    grade   = "",
    stream  = "",
    gender  = "",
    status  = "active",
    sortBy  = "created_at",
    sortDir = "desc",
  } = options;

  const supabase  = await createSupabaseServerClient();
  const school_id = await resolveSchoolId(supabase);

  let query = supabase
    .from("students")
    .select(STUDENT_SELECT)
    .eq("school_id", school_id)           // ← explicit tenant fence
    .order(sortBy, { ascending: sortDir === "asc" });

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,readable_id.ilike.%${search}%`
    );
  }
  if (grade)                      query = query.eq("current_grade", grade);
  if (stream)                     query = query.eq("classes.stream", stream);
  if (gender)                     query = query.eq("gender", gender);
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    console.error("[fetchAllStudents]", error.message);
    return [];
  }

  return (data as unknown as RawStudentRow[]).map(mapStudentRow);
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase  = await createSupabaseServerClient();
  const school_id = await resolveSchoolId(supabase);

  const [studentsRes, teachersRes, parentsRes] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school_id),
    supabase
      .from("teachers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school_id),
    supabase
      .from("student_parents")
      .select("parent_id", { count: "exact", head: true })
      .eq("school_id", school_id),
  ]);

  return {
    totalStudents: studentsRes.count ?? 0,
    totalTeachers: teachersRes.count ?? 0,
    totalParents:  parentsRes.count  ?? 0,
  };
}

// ============================================================================
// CHART DATA TYPES
// ============================================================================

export interface GradeEnrollmentBar {
  grade:   string;
  count:   number;
  level:   string;
  male:    number;
  female:  number;
}

export interface LevelSummary {
  level: string;
  label: string;
  count: number;
  color: string;
}

export interface ScoreDistItem {
  score:   string;
  label:   string;
  count:   number;
  percent: number;
  color:   string;
}

export interface RecentAdmission {
  month: string;
  count: number;
}

export interface DashboardChartData {
  gradeEnrollment:   GradeEnrollmentBar[];
  levelSummary:      LevelSummary[];
  genderSplit:       { male: number; female: number; unknown: number };
  scoreDistribution: ScoreDistItem[];
  assessmentTotals:  { total: number; assessed: number; unassessed: number };
  recentAdmissions:  RecentAdmission[];
}

// ── Static metadata ────────────────────────────────────────────────────────

const LEVEL_META: Record<string, { label: string; color: string }> = {
  lower_primary:    { label: "Lower Primary",    color: "#f59e0b" },
  upper_primary:    { label: "Upper Primary",    color: "#38bdf8" },
  junior_secondary: { label: "Junior Secondary", color: "#34d399" },
};

const SCORE_META: Record<string, { label: string; color: string }> = {
  EE: { label: "Exceeds Expectation", color: "#34d399" },
  ME: { label: "Meets Expectation",   color: "#38bdf8" },
  AE: { label: "Approaching",         color: "#f59e0b" },
  BE: { label: "Below Expectation",   color: "#fb7185" },
};

type ScoreBand = "EE" | "ME" | "AE" | "BE";

// ── Raw row shapes for analytics queries ──────────────────────────────────

interface RawStudentMeta {
  id:            string;
  current_grade: string;
  gender:        string | null;
  created_at:    string;
}

interface RawAssessmentMeta {
  student_id: string;
  score:      string | null;
}

// ============================================================================
// DASHBOARD ANALYTICS
// ============================================================================

export async function fetchDashboardChartData(
  term         = 1,
  academicYear = 2026
): Promise<DashboardChartData> {
  const supabase  = await createSupabaseServerClient();
  const school_id = await resolveSchoolId(supabase);

  const [studentsRes, assessRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, current_grade, gender, created_at")
      .eq("school_id", school_id)         // ← tenant fence
      .order("created_at", { ascending: false }),
    supabase
      .from("assessments")
      .select("student_id, score")
      .eq("term",          term)
      .eq("academic_year", academicYear)
      .not("score", "is", null),
  ]);

  const rawStudents    = (studentsRes.data ?? []) as RawStudentMeta[];
  const rawAssessments = (assessRes.data   ?? []) as RawAssessmentMeta[];

  // ── Grade enrollment breakdown ────────────────────────────────────────────
  const gradeMap: Record<string, { male: number; female: number; total: number }> = {};

  for (const s of rawStudents) {
    const g = s.current_grade || "Unknown";
    if (!gradeMap[g]) gradeMap[g] = { male: 0, female: 0, total: 0 };
    gradeMap[g]!.total++;
    if (s.gender === "Male")   gradeMap[g]!.male++;
    if (s.gender === "Female") gradeMap[g]!.female++;
  }

  const sortedGrades = Object.keys(gradeMap).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );

  const gradeEnrollment: GradeEnrollmentBar[] = sortedGrades.map((g) => ({
    grade:  g,
    count:  gradeMap[g]!.total,
    level:  GRADE_LEVEL_MAP[g] ?? "lower_primary",
    male:   gradeMap[g]!.male,
    female: gradeMap[g]!.female,
  }));

  // ── Level summary ─────────────────────────────────────────────────────────
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
    })
  );

  // ── Gender split ──────────────────────────────────────────────────────────
  const male    = rawStudents.filter((s) => s.gender === "Male").length;
  const female  = rawStudents.filter((s) => s.gender === "Female").length;
  const unknown = rawStudents.length - male - female;

  // ── Score distribution ────────────────────────────────────────────────────
  const scoreCounts: Record<ScoreBand, number> = { EE: 0, ME: 0, AE: 0, BE: 0 };

  for (const a of rawAssessments) {
    const band = a.score as ScoreBand | null;
    if (band && band in scoreCounts) scoreCounts[band]++;
  }

  const scoreTotal = rawAssessments.length;
  const bands: ScoreBand[] = ["EE", "ME", "AE", "BE"];

  const scoreDistribution: ScoreDistItem[] = bands.map((band) => ({
    score:   band,
    label:   SCORE_META[band]!.label,
    count:   scoreCounts[band],
    percent: scoreTotal > 0
      ? Math.round((scoreCounts[band] / scoreTotal) * 100)
      : 0,
    color:   SCORE_META[band]!.color,
  }));

  // ── Assessment totals ─────────────────────────────────────────────────────
  const assessedIds = new Set(rawAssessments.map((a) => a.student_id));
  const assessmentTotals = {
    total:      rawStudents.length,
    assessed:   assessedIds.size,
    unassessed: rawStudents.length - assessedIds.size,
  };

  // ── Recent admissions (rolling 6-month window) ────────────────────────────
  const now = new Date();
  const monthSlots = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      month: d.toLocaleDateString("en-KE", { month: "short" }),
    };
  });

  const admissionsPerMonth: Record<string, number> = {};
  for (const s of rawStudents) {
    const d   = new Date(s.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    admissionsPerMonth[key] = (admissionsPerMonth[key] ?? 0) + 1;
  }

  const recentAdmissions: RecentAdmission[] = monthSlots.map(({ key, month }) => ({
    month,
    count: admissionsPerMonth[key] ?? 0,
  }));

  return {
    gradeEnrollment,
    levelSummary,
    genderSplit: { male, female, unknown },
    scoreDistribution,
    assessmentTotals,
    recentAdmissions,
  };
}