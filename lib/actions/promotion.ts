"use server";
// lib/actions/promotion.ts
// CBC grade promotion — end-of-year bulk advancement.
// Rules:
//   PP1 → PP2 → Grade 1 → … → Grade 9 (terminal)
//   Admin + superadmin only; requires explicit UI confirmation
//   Promotes in reverse grade order to avoid double-promotion
//   Grade 9 graduates are marked but NOT deleted

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import { ALL_GRADES } from "@/lib/types/allocation";

export interface PromotionResult {
  success: boolean;
  message: string;
  promoted?: number;
  fromGrade?: string;
  toGrade?: string;
}

export interface GradeCount {
  grade: string;
  count: number;
  next: string | null;
}

// ── Grade progression map ─────────────────────────────────────────────────────

const NEXT_GRADE: Record<string, string | null> = {};
for (let i = 0; i < ALL_GRADES.length; i++) {
  NEXT_GRADE[ALL_GRADES[i]!] = ALL_GRADES[i + 1] ?? null;
}

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
  for (const row of data as { current_grade: string }[]) {
    countMap[row.current_grade] = (countMap[row.current_grade] ?? 0) + 1;
  }

  return ALL_GRADES.filter((g) => countMap[g]).map((g) => ({
    grade: g,
    count: countMap[g]!,
    next: NEXT_GRADE[g] ?? null,
  }));
}

// ── Promote a single grade ────────────────────────────────────────────────────

export async function promoteGradeAction(
  fromGrade: string,
): Promise<PromotionResult> {
  await requireAdmin();

  if (!ALL_GRADES.includes(fromGrade))
    return { success: false, message: "Invalid grade specified." };

  const toGrade = NEXT_GRADE[fromGrade];
  if (!toGrade) {
    return {
      success: false,
      message: `${fromGrade} is the final grade — students here are ready to graduate.`,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("current_grade", fromGrade)
    .eq("status", "active");

  if (!count || count === 0)
    return {
      success: false,
      message: `No active students found in ${fromGrade}.`,
    };

  const { error } = await supabase
    .from("students")
    .update({ current_grade: toGrade })
    .eq("current_grade", fromGrade)
    .eq("status", "active");

  if (error) {
    console.error("[promoteGrade]", error.message);
    return { success: false, message: `Failed to promote: ${error.message}` };
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/students");
  revalidatePath("/admin/promotion");

  return {
    success: true,
    message: `${count} student${count !== 1 ? "s" : ""} promoted: ${fromGrade} → ${toGrade}.`,
    promoted: count,
    fromGrade,
    toGrade,
  };
}

// ── Promote ALL grades (end-of-year) ─────────────────────────────────────────
// Processes in reverse order — Grade 8 → 9 before Grade 7 → 8 — so no
// student is promoted twice in one operation.

export async function promoteAllGradesAction(): Promise<PromotionResult[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("students")
    .select("current_grade")
    .eq("status", "active");

  if (!data)
    return [{ success: false, message: "Could not fetch student data." }];

  const countMap: Record<string, number> = {};
  for (const row of data as { current_grade: string }[]) {
    countMap[row.current_grade] = (countMap[row.current_grade] ?? 0) + 1;
  }

  const gradesToPromote = [...ALL_GRADES]
    .reverse()
    .filter((g) => countMap[g] && NEXT_GRADE[g] !== null);

  const results: PromotionResult[] = [];

  for (const fromGrade of gradesToPromote) {
    const toGrade = NEXT_GRADE[fromGrade]!;
    const { error } = await supabase
      .from("students")
      .update({ current_grade: toGrade })
      .eq("current_grade", fromGrade)
      .eq("status", "active");

    results.push(
      error
        ? {
            success: false,
            message: `Failed to promote ${fromGrade}: ${error.message}`,
            fromGrade,
            toGrade,
          }
        : {
            success: true,
            message: `${countMap[fromGrade]} student${countMap[fromGrade]! !== 1 ? "s" : ""} promoted: ${fromGrade} → ${toGrade}`,
            promoted: countMap[fromGrade],
            fromGrade,
            toGrade,
          },
    );
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/students");
  revalidatePath("/admin/promotion");

  return results;
}
