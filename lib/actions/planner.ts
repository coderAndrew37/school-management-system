"use server";
// lib/actions/planner.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface ActionResult {
  success: boolean;
  message: string;
}

export type PlanStatus = "planned" | "in_progress" | "taught" | "skipped";

export interface LessonPlan {
  id: string;
  teacher_id: string;
  subject_name: string;
  grade: string;
  academic_year: number;
  term: number;
  week_number: number;
  topic: string;
  strand_id: string | null;
  objectives: string | null;
  activities: string | null;
  resources: string | null;
  assessment_note: string | null;
  status: PlanStatus;
  taught_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const planSchema = z.object({
  subject_name: z.string().min(1),
  grade: z.string().min(1),
  academic_year: z.number().int().default(2026),
  term: z.number().int().min(1).max(3),
  week_number: z.number().int().min(1).max(18),
  topic: z.string().min(1).max(300),
  strand_id: z.string().optional().nullable(),
  objectives: z.string().optional().nullable(),
  activities: z.string().optional().nullable(),
  resources: z.string().optional().nullable(),
  assessment_note: z.string().optional().nullable(),
  status: z
    .enum(["planned", "in_progress", "taught", "skipped"])
    .default("planned"),
  taught_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// ── Upsert (create or update a week's plan) ────────────────────────────────

export async function upsertLessonPlanAction(
  data: z.input<typeof planSchema>,
  existingId?: string,
): Promise<ActionResult & { id?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return { success: false, message: "Not authenticated." };

  const parsed = planSchema.safeParse(data);
  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };

  const payload = {
    teacher_id: user.id,
    subject_name: parsed.data.subject_name,
    grade: parsed.data.grade,
    academic_year: parsed.data.academic_year,
    term: parsed.data.term,
    week_number: parsed.data.week_number,
    topic: parsed.data.topic,
    strand_id: parsed.data.strand_id ?? null,
    objectives: parsed.data.objectives ?? null,
    activities: parsed.data.activities ?? null,
    resources: parsed.data.resources ?? null,
    assessment_note: parsed.data.assessment_note ?? null,
    status: parsed.data.status,
    taught_at: parsed.data.taught_at ?? null,
    notes: parsed.data.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data: result, error } = existingId
    ? await supabase
        .from("lesson_plans")
        .update(payload)
        .eq("id", existingId)
        .eq("teacher_id", user.id)
        .select("id")
        .single<{ id: string }>()
    : await supabase
        .from("lesson_plans")
        .upsert(payload, {
          onConflict:
            "teacher_id,subject_name,grade,academic_year,term,week_number",
        })
        .select("id")
        .single<{ id: string }>();

  if (error) {
    console.error("[upsertLessonPlanAction]", error.message);
    return { success: false, message: "Failed to save plan." };
  }

  revalidatePath("/teacher/planner");
  return { success: true, message: "Plan saved.", id: result?.id };
}

// ── Quick status update ────────────────────────────────────────────────────

export async function updatePlanStatusAction(
  id: string,
  status: PlanStatus,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return { success: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("lesson_plans")
    .update({
      status,
      taught_at:
        status === "taught" ? new Date().toISOString().split("T")[0] : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { success: false, message: "Failed to update status." };
  revalidatePath("/teacher/planner");
  return { success: true, message: `Marked as ${status}.` };
}

// ── Delete ─────────────────────────────────────────────────────────────────

export async function deleteLessonPlanAction(
  id: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return { success: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("lesson_plans")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { success: false, message: "Failed to delete." };
  revalidatePath("/teacher/planner");
  return { success: true, message: "Plan deleted." };
}

// ── Fetch plans ────────────────────────────────────────────────────────────

export async function fetchLessonPlansAction(
  grade: string,
  subjectName: string,
  term: number,
  academicYear: number = 2026,
): Promise<LessonPlan[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("lesson_plans")
    .select("*")
    .eq("teacher_id", user.id)
    .eq("grade", grade)
    .eq("subject_name", subjectName)
    .eq("academic_year", academicYear)
    .eq("term", term)
    .order("week_number");

  if (error) {
    console.error("[fetchLessonPlansAction]", error.message);
    return [];
  }

  return (data ?? []) as LessonPlan[];
}
