"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import { CBC_ORDER, getNextGrade } from "@/lib/utils/promotion-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PromotionResult {
  success: boolean;
  message: string;
  promoted?: number;
  fromGrade?: string;
  toGrade?: string;
  errors?: string[];
}

export interface GradeCount {
  grade: string;
  count: number;
  next: string | null;
}

/**
 * Security middleware
 */
async function requireAdmin() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    throw new Error("Forbidden: admin access required");
  }
  return session;
}

// ── Fetch grade counts for promotion preview ──────────────────────────────────

export async function fetchGradesForPromotion(): Promise<GradeCount[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("students")
    .select("current_grade")
    .eq("status", "active");

  if (error || !data) return [];

  const countMap: Record<string, number> = {};
  data.forEach((row) => {
    countMap[row.current_grade] = (countMap[row.current_grade] ?? 0) + 1;
  });

  return CBC_ORDER.filter((g) => countMap[g] !== undefined).map((g) => ({
    grade: g,
    count: countMap[g],
    next: getNextGrade(g),
  }));
}

// ── Promote ALL grades (Bulk End-of-Year) ─────────────────────────────────────

export async function promoteAllGradesAction(targetYear: number): Promise<PromotionResult[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // 1. Validate that target classes exist for the new year
  const { data: targetClasses } = await supabase
    .from("classes")
    .select("grade, stream")
    .eq("academic_year", targetYear);

  if (!targetClasses || targetClasses.length === 0) {
    return [{ 
      success: false, 
      message: `Aborted: No classes found for the ${targetYear} academic year. Create classes first.` 
    }];
  }

  // 2. Fetch active students
  const { data: students } = await supabase
    .from("students")
    .select("id, current_grade, stream")
    .eq("status", "active");

  if (!students || students.length === 0) {
    return [{ success: false, message: "No active students found to promote." }];
  }

  // 3. Process grades in reverse order to prevent double-promotion logic issues
  const results: PromotionResult[] = [];
  const reversedGrades = [...CBC_ORDER].reverse();

  for (const fromGrade of reversedGrades) {
    const toGrade = getNextGrade(fromGrade);
    if (!toGrade) continue; 

    const studentsInGrade = students.filter(s => s.current_grade === fromGrade);
    if (studentsInGrade.length === 0) continue;

    let promotedInThisGrade = 0;
    const gradeErrors: string[] = [];

    for (const student of studentsInGrade) {
      const streamExists = targetClasses.some(
        c => c.grade === toGrade && c.stream === student.stream
      );

      if (streamExists) {
        const { error } = await supabase
          .from("students")
          .update({ current_grade: toGrade })
          .eq("id", student.id);
        
        if (!error) promotedInThisGrade++;
        else gradeErrors.push(`Failed to update student ID ${student.id}`);
      } else {
        gradeErrors.push(`Stream "${student.stream}" missing in ${toGrade} for year ${targetYear}.`);
      }
    }

    results.push({
      success: gradeErrors.length === 0,
      message: promotedInThisGrade > 0 
        ? `Promoted ${promotedInThisGrade} students: ${fromGrade} → ${toGrade}`
        : `Skipped ${fromGrade}: No valid target streams found.`,
      promoted: promotedInThisGrade,
      fromGrade,
      toGrade,
      errors: gradeErrors.length > 0 ? Array.from(new Set(gradeErrors)) : undefined
    });
  }

  refreshCache();
  return results;
}

// ── Promote Single Grade ──────────────────────────────────────────────────────

export async function promoteGradeAction(
  fromGrade: string, 
  targetYear: number
): Promise<PromotionResult> {
  await requireAdmin();
  const toGrade = getNextGrade(fromGrade);
  
  if (!toGrade) {
    return { success: false, message: "Cannot promote terminal grade. Use Graduation." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: targetClasses } = await supabase
    .from("classes")
    .select("stream")
    .eq("grade", toGrade)
    .eq("academic_year", targetYear);

  const { data: students } = await supabase
    .from("students")
    .select("id, stream")
    .eq("current_grade", fromGrade)
    .eq("status", "active");

  if (!students || students.length === 0) {
    return { success: false, message: `No active students in ${fromGrade}.` };
  }

  let count = 0;
  for (const student of students) {
    if (targetClasses?.some(tc => tc.stream === student.stream)) {
      const { error } = await supabase
        .from("students")
        .update({ current_grade: toGrade })
        .eq("id", student.id);
      if (!error) count++;
    }
  }

  refreshCache();
  return {
    success: true,
    message: `Promoted ${count} students from ${fromGrade} to ${toGrade} (${targetYear}).`,
    promoted: count,
    fromGrade,
    toGrade
  };
}

// ── Graduate Terminal Grade ───────────────────────────────────────────────────

export async function graduateGradeAction(grade: string): Promise<PromotionResult> {
  await requireAdmin();
  if (getNextGrade(grade) !== null) {
    return { success: false, message: "Only Grade 9 can be graduated." };
  }

  const supabase = await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("students")
    .update({ status: "graduated" })
    .eq("current_grade", grade)
    .eq("status", "active")
    .select("id");

  if (error) return { success: false, message: error.message };

  refreshCache();
  return { 
    success: true, 
    message: `${count ?? 0} students from ${grade} marked as graduated.`,
    promoted: count ?? 0
  };
}

// ── Cache Invalidation ────────────────────────────────────────────────────────

function refreshCache() {
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/students");
  revalidatePath("/admin/promotion");
}