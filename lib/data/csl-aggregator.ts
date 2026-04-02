// ============================================================
// lib/data/csl-aggregator.ts
// CSL Logbook — per-student performance aggregation + SBA grade mapping
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DbCSLEntry,
  CSLStudentSummary,
  CSLPerformanceResult,
  CSLPerformanceLevel,
} from "@/types/csl";
import { CSL_HOUR_TARGET, CSL_REFLECTION_MIN_WORDS } from "@/types/csl";
import type { CbcScore } from "@/types/knec";

// ── Performance level calculation ─────────────────────────────────────────────

/**
 * Derives a KNEC CSL Performance Level (EE/ME/AE/BE) from:
 *   - Total hours vs 20-hour target (60% weight)
 *   - Reflection quality — avg word count vs minimum (40% weight)
 *
 * EE = 90–100%  |  ME = 65–89%  |  AE = 40–64%  |  BE = 0–39%
 */
function calcCSLPerformance(entries: DbCSLEntry[]): CSLPerformanceResult {
  const totalHours = entries.reduce((s, e) => s + e.hours_spent, 0);
  const approvedCount = entries.filter(
    (e) => e.supervisor_status === "approved",
  ).length;
  const approvedHours = entries
    .filter((e) => e.supervisor_status === "approved")
    .reduce((s, e) => s + e.hours_spent, 0);

  const hoursPct = Math.min((totalHours / CSL_HOUR_TARGET) * 100, 100);

  // Reflection quality: avg word count normalised against target
  const wordCounts = entries.map(
    (e) => e.student_reflection.trim().split(/\s+/).filter(Boolean).length,
  );
  const avgWords =
    wordCounts.length > 0
      ? wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length
      : 0;
  const reflectionScore = Math.min(
    (avgWords / CSL_REFLECTION_MIN_WORDS) * 100,
    100,
  );

  // Weighted composite: 60% hours, 40% reflection quality
  const composite = hoursPct * 0.6 + reflectionScore * 0.4;

  let level: CSLPerformanceLevel;
  if (composite >= 90) level = "EE";
  else if (composite >= 65) level = "ME";
  else if (composite >= 40) level = "AE";
  else level = "BE";

  const fullyApproved = entries.length > 0 && approvedCount === entries.length;

  const summary =
    `${totalHours}/${CSL_HOUR_TARGET} hrs · ` +
    `${approvedCount}/${entries.length} entries approved · ` +
    `avg reflection ${Math.round(avgWords)} words`;

  return {
    level,
    totalHours,
    approvedHours,
    hoursTarget: CSL_HOUR_TARGET,
    hoursPct: parseFloat(hoursPct.toFixed(1)),
    entryCount: entries.length,
    approvedCount,
    avgReflectionWords: Math.round(avgWords),
    fullyApproved,
    summary,
  };
}

// ── Fetch class CSL data ──────────────────────────────────────────────────────

export async function getCSLClassData(
  grade: string = "Grade 9 / JSS 3",
  academicYear: number = 2026,
): Promise<CSLStudentSummary[]> {
  const supabase = await createSupabaseServerClient();

  const [studentsRes, entriesRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, upi_number, readable_id, current_grade")
      .eq("current_grade", grade)
      .eq("status", "active")
      .order("full_name"),

    supabase.from("csl_logbook").select("*").eq("academic_year", academicYear),
  ]);

  if (studentsRes.error)
    console.error("[CSL] students:", studentsRes.error.message);
  if (entriesRes.error)
    console.error("[CSL] entries:", entriesRes.error.message);

  const students = studentsRes.data ?? [];
  const allEntries = (entriesRes.data ?? []) as DbCSLEntry[];

  return students.map((student) => {
    const entries = allEntries.filter((e) => e.student_id === student.id);
    const performance = calcCSLPerformance(entries);
    return {
      studentId: student.id,
      fullName: student.full_name,
      upiNumber: student.upi_number,
      entries,
      performance,
      sbaGrade: performance.level as CbcScore,
    } satisfies CSLStudentSummary;
  });
}

/** Fetch a single student's CSL entries — used by the student/parent view */
export async function getStudentCSLEntries(
  studentId: string,
  academicYear: number = 2026,
): Promise<{ entries: DbCSLEntry[]; performance: CSLPerformanceResult }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("csl_logbook")
    .select("*")
    .eq("student_id", studentId)
    .eq("academic_year", academicYear)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[CSL] getStudentEntries:", error.message);
    return { entries: [], performance: calcCSLPerformance([]) };
  }

  const entries = (data ?? []) as DbCSLEntry[];
  return { entries, performance: calcCSLPerformance(entries) };
}
