// ============================================================
// lib/data/kpsea-engine.ts
// Grade 6 KPSEA — cumulative SBA aggregator (G4 + G5 + G6)
// ============================================================
// Designed for easy TanStack Query adoption:
// extract fetchKPSEAData() into a server action, then swap
// the direct call for useQuery(() => fetchKPSEAData()) + Dexie.js cache.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DbAssessmentRow,
  DbHistoricalOverride,
  DbStudentRow,
  DbSubjectRow,
  IHistoricalData,
  IKPSEAScore,
  KPSEAArea,
  KPSEAReadinessStatus,
  KPSEAStudentRow,
  YearSBAData,
} from "@/types/knec";
import { KPSEA_AREAS, KPSEA_AREA_MAP } from "@/types/knec";

// ── Year → grade label ────────────────────────────────────────────────────────
// In a 2026 Grade 6 class: G4=2024, G5=2025, G6=2026
function gradeLabel(yearOffset: number): string {
  const map: Record<number, string> = {
    0: "Grade 4",
    1: "Grade 5",
    2: "Grade 6",
  };
  return map[yearOffset] ?? `Year -${yearOffset}`;
}

// ── Per-area percentage from assessment rows ──────────────────────────────────
function calcAreaPct(rows: DbAssessmentRow[]): number | null {
  if (rows.length === 0) return null;
  const withBoth = rows.filter(
    (r) =>
      r.raw_score !== null && r.max_score !== null && (r.max_score ?? 0) > 0,
  );
  if (withBoth.length > 0) {
    return (
      withBoth.reduce(
        (sum, r) => sum + (r.raw_score! / r.max_score!) * 100,
        0,
      ) / withBoth.length
    );
  }
  // Fallback: score ordinal average
  const scoreVal: Record<string, number> = { EE: 100, ME: 75, AE: 50, BE: 25 };
  const valid = rows.filter((r) => r.score && r.score in scoreVal);
  if (valid.length === 0) return null;
  return valid.reduce((sum, r) => sum + scoreVal[r.score!]!, 0) / valid.length;
}

/**
 * Given all assessment rows for a student + year, and the subject→area map,
 * compute the average % for each KPSEA composite area.
 */
function buildAreaPct(
  rows: DbAssessmentRow[],
  areaBySubject: Map<string, string>,
): Partial<Record<KPSEAArea, number>> {
  // Group rows by KPSEA composite area
  const byArea = new Map<KPSEAArea, DbAssessmentRow[]>();

  for (const row of rows) {
    const subjectArea = areaBySubject.get(row.subject_name);
    if (!subjectArea) continue;

    for (const kpsea of KPSEA_AREAS) {
      if (KPSEA_AREA_MAP[kpsea].includes(subjectArea)) {
        if (!byArea.has(kpsea)) byArea.set(kpsea, []);
        byArea.get(kpsea)!.push(row);
        break; // each subject maps to exactly one KPSEA area
      }
    }
  }

  const result: Partial<Record<KPSEAArea, number>> = {};
  for (const area of KPSEA_AREAS) {
    const pct = calcAreaPct(byArea.get(area) ?? []);
    if (pct !== null) result[area] = pct;
  }
  return result;
}

// ── Build IHistoricalData for one student ─────────────────────────────────────
function buildHistoricalData(
  assessmentsByYear: Map<number, DbAssessmentRow[]>,
  overridesByYear: Map<number, DbHistoricalOverride[]>,
  areaBySubject: Map<string, string>,
  g6Year: number,
): IHistoricalData {
  const years = [g6Year - 2, g6Year - 1, g6Year] as const;
  const labels = ["Grade 4", "Grade 5", "Grade 6"] as const;

  const buildYear = (year: number, label: string): YearSBAData => {
    const rows = assessmentsByYear.get(year) ?? [];
    const overrides = overridesByYear.get(year) ?? [];

    if (rows.length > 0) {
      return {
        year,
        gradeLabel: label,
        status: overrides.length > 0 ? "override" : "complete",
        areaPct: buildAreaPct(rows, areaBySubject),
      } satisfies YearSBAData;
    }

    if (overrides.length > 0) {
      const areaPct: Partial<Record<KPSEAArea, number>> = {};
      for (const ov of overrides) {
        if (KPSEA_AREAS.includes(ov.knec_area as KPSEAArea)) {
          areaPct[ov.knec_area as KPSEAArea] = ov.avg_percentage;
        }
      }
      return { year, gradeLabel: label, status: "override", areaPct };
    }

    return { year, gradeLabel: label, status: "missing", areaPct: {} };
  };

  return {
    g4: buildYear(years[0], labels[0]),
    g5: buildYear(years[1], labels[1]),
    g6: buildYear(years[2], labels[2]),
  };
}

// ── Compute IKPSEAScore[] from IHistoricalData ────────────────────────────────
function computeScores(hist: IHistoricalData): IKPSEAScore[] {
  return KPSEA_AREAS.map((area) => {
    const g4 = hist.g4.areaPct[area] ?? null;
    const g5 = hist.g5.areaPct[area] ?? null;
    const g6 = hist.g6.areaPct[area] ?? null;

    const available = [g4, g5, g6].filter((v): v is number => v !== null);
    const avgPct =
      available.length === 3 ? available.reduce((a, b) => a + b, 0) / 3 : null; // require all 3 years for a valid cumulative

    return {
      area,
      avgPct,
      g4Pct: g4,
      g5Pct: g5,
      g6Pct: g6,
      sba60: avgPct !== null ? parseFloat((avgPct * 0.6).toFixed(2)) : null,
    } satisfies IKPSEAScore;
  });
}

// ── Readiness status ──────────────────────────────────────────────────────────
function getReadinessStatus(
  student: DbStudentRow,
  hist: IHistoricalData,
): KPSEAReadinessStatus {
  if (!student.upi_number) return "missing_upi";
  if (!student.assessment_number) return "missing_assessment_number";
  if (hist.g4.status === "missing" || hist.g5.status === "missing")
    return "missing_years";
  return "ready";
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Aggregate KPSEA readiness data for all Grade 6 students.
 * Fetches G4, G5, G6 assessments and manual overrides in parallel.
 *
 * TanStack Query adoption: extract the Supabase calls into a
 * `/api/kpsea` route, then use `useQuery(["kpsea", grade], fetchFn)`.
 */
export async function getKPSEACumulativeData(
  grade: string = "Grade 6",
  g6Year: number = 2026,
): Promise<KPSEAStudentRow[]> {
  const supabase = await createSupabaseServerClient();
  const years = [g6Year - 2, g6Year - 1, g6Year];

  // ── Parallel fetches ───────────────────────────────────────────────────────
  const [studentsRes, assessmentsRes, subjectsRes, overridesRes] =
    await Promise.all([
      supabase
        .from("students")
        .select(
          "id, full_name, upi_number, assessment_number, gender, current_grade, readable_id",
        )
        .eq("current_grade", grade)
        .eq("status", "active")
        .order("full_name"),

      supabase
        .from("assessments")
        .select(
          "id, student_id, subject_name, strand_id, score, raw_score, max_score, is_final_sba, term, academic_year, offline_id",
        )
        .in("academic_year", years)
        .eq("is_final_sba", true),

      supabase
        .from("subjects")
        .select("id, name, code, level, knec_learning_area")
        .eq("level", "upper_primary"),

      supabase
        .from("historical_sba_overrides")
        .select(
          "id, student_id, academic_year, knec_area, avg_percentage, source_school, entered_at, notes",
        )
        .in("academic_year", years),
    ]);

  if (studentsRes.error)
    console.error("[KPSEA] students:", studentsRes.error.message);
  if (assessmentsRes.error)
    console.error("[KPSEA] assessments:", assessmentsRes.error.message);
  if (subjectsRes.error)
    console.error("[KPSEA] subjects:", subjectsRes.error.message);
  if (overridesRes.error)
    console.error("[KPSEA] overrides:", overridesRes.error.message);

  const students = (studentsRes.data ?? []) as DbStudentRow[];
  const assessments = (assessmentsRes.data ?? []) as DbAssessmentRow[];
  const subjects = (subjectsRes.data ?? []) as DbSubjectRow[];
  const overrides = (overridesRes.data ?? []) as DbHistoricalOverride[];

  // Build subject → KNEC area lookup
  const areaBySubject = new Map<string, string>();
  for (const s of subjects) {
    if (s.knec_learning_area) areaBySubject.set(s.name, s.knec_learning_area);
  }

  // ── Per-student aggregation ────────────────────────────────────────────────
  return students.map((student) => {
    // Group this student's assessments by year
    const assessmentsByYear = new Map<number, DbAssessmentRow[]>();
    for (const a of assessments) {
      if (a.student_id !== student.id) continue;
      if (!assessmentsByYear.has(a.academic_year))
        assessmentsByYear.set(a.academic_year, []);
      assessmentsByYear.get(a.academic_year)!.push(a);
    }

    // Group this student's overrides by year
    const overridesByYear = new Map<number, DbHistoricalOverride[]>();
    for (const o of overrides) {
      if (o.student_id !== student.id) continue;
      if (!overridesByYear.has(o.academic_year))
        overridesByYear.set(o.academic_year, []);
      overridesByYear.get(o.academic_year)!.push(o);
    }

    const hist = buildHistoricalData(
      assessmentsByYear,
      overridesByYear,
      areaBySubject,
      g6Year,
    );
    const scores = computeScores(hist);
    const readiness = getReadinessStatus(student, hist);
    const hasOverrides = [hist.g4, hist.g5, hist.g6].some(
      (y) => y.status === "override",
    );

    const validSBA = scores
      .map((s) => s.sba60)
      .filter((v): v is number => v !== null);
    const totalSBA =
      validSBA.length === KPSEA_AREAS.length
        ? parseFloat(
            (validSBA.reduce((a, b) => a + b, 0) / validSBA.length).toFixed(2),
          )
        : null;

    return {
      studentId: student.id,
      fullName: student.full_name,
      upiNumber: student.upi_number,
      assessmentNumber: student.assessment_number,
      gender: student.gender,
      historicalData: hist,
      scores,
      totalSBA,
      readinessStatus: readiness,
      hasOverrides,
    } satisfies KPSEAStudentRow;
  });
}

/**
 * Single-student KPSEA data (used by the Manual Override modal after saving).
 * Abstracted so TanStack Query can invalidate just this student's cache key.
 */
export async function getKPSEAStudentData(
  studentId: string,
  g6Year: number = 2026,
): Promise<KPSEAStudentRow | null> {
  const all = await getKPSEACumulativeData("Grade 6", g6Year);
  return all.find((s) => s.studentId === studentId) ?? null;
}
