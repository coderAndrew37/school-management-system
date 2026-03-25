"use server";
// lib/actions/conduct.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";

export interface ActionResult {
  success: boolean;
  message: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConductType = "merit" | "demerit" | "incident";
export type ConductCategory =
  | "academic"
  | "behaviour"
  | "leadership"
  | "sport"
  | "community"
  | "other";
export type Severity = "low" | "medium" | "high";

export interface ConductRecord {
  id: string;
  student_id: string;
  student_name: string;
  teacher_id: string;
  grade: string;
  academic_year: number;
  term: number;
  type: ConductType;
  category: ConductCategory;
  points: number;
  description: string;
  action_taken: string | null;
  parent_notified: boolean;
  parent_ack_at: string | null;
  severity: Severity | null;
  is_resolved: boolean;
  created_at: string;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const conductSchema = z.object({
  student_id: z.string().uuid(),
  grade: z.string().min(1),
  academic_year: z.number().int().default(2026),
  term: z.number().int().min(1).max(3),
  type: z.enum(["merit", "demerit", "incident"]),
  category: z.enum([
    "academic",
    "behaviour",
    "leadership",
    "sport",
    "community",
    "other",
  ]),
  points: z.number().int(),
  description: z.string().min(1).max(1000),
  action_taken: z.string().optional().nullable(),
  severity: z.enum(["low", "medium", "high"]).optional().nullable(),
});

// ── Create record ─────────────────────────────────────────────────────────────

export async function createConductRecordAction(
  data: z.input<typeof conductSchema>,
): Promise<ActionResult & { id?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return { success: false, message: "Not authenticated." };

  const parsed = conductSchema.safeParse(data);
  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };

  const { data: record, error } = await supabase
    .from("student_conduct")
    .insert({
      student_id: parsed.data.student_id,
      teacher_id: user.id,
      grade: parsed.data.grade,
      academic_year: parsed.data.academic_year,
      term: parsed.data.term,
      type: parsed.data.type,
      category: parsed.data.category,
      points:
        parsed.data.type === "merit"
          ? Math.abs(parsed.data.points)
          : parsed.data.type === "demerit"
            ? -Math.abs(parsed.data.points)
            : 0,
      description: parsed.data.description,
      action_taken: parsed.data.action_taken ?? null,
      severity:
        parsed.data.type === "incident"
          ? (parsed.data.severity ?? "low")
          : null,
      parent_notified: false,
      is_resolved: false,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    console.error("[createConductRecordAction]", error.message);
    return { success: false, message: "Failed to save record." };
  }

  revalidatePath("/teacher/conduct");
  revalidatePath("/parent");
  return { success: true, message: "Record saved.", id: record?.id };
}

// ── Update record ─────────────────────────────────────────────────────────────

export async function updateConductRecordAction(
  id: string,
  data: Partial<z.input<typeof conductSchema>> & {
    action_taken?: string | null;
    is_resolved?: boolean;
  },
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return { success: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("student_conduct")
    .update({
      ...data,
      ...(data.type === "merit" ? { points: Math.abs(data.points ?? 0) } : {}),
      ...(data.type === "demerit"
        ? { points: -Math.abs(data.points ?? 0) }
        : {}),
    })
    .eq("id", id)
    .eq("teacher_id", user.id); // teachers can only edit their own

  if (error) return { success: false, message: "Failed to update." };
  revalidatePath("/teacher/conduct");
  return { success: true, message: "Record updated." };
}

// ── Delete record ─────────────────────────────────────────────────────────────

export async function deleteConductRecordAction(
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
    .from("student_conduct")
    .delete()
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { success: false, message: "Failed to delete." };
  revalidatePath("/teacher/conduct");
  return { success: true, message: "Record deleted." };
}

// ── Notify parent ─────────────────────────────────────────────────────────────

export async function notifyParentConductAction(
  recordId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return { success: false, message: "Not authenticated." };

  // Get the record + student name
  const { data: record, error: fetchErr } = await supabaseAdmin
    .from("student_conduct")
    .select(
      "id, student_id, type, description, severity, grade, students ( full_name )",
    )
    .eq("id", recordId)
    .single<{
      id: string;
      student_id: string;
      type: string;
      description: string;
      severity: string | null;
      grade: string;
      students: { full_name: string } | null;
    }>();

  if (fetchErr || !record)
    return { success: false, message: "Record not found." };

  const studentName = record.students?.full_name ?? "your child";
  const emoji =
    record.type === "merit" ? "🏅" : record.type === "incident" ? "⚠️" : "📋";
  const title =
    record.type === "merit"
      ? `${emoji} Merit awarded — ${studentName}`
      : record.type === "incident"
        ? `${emoji} Incident report — ${studentName}`
        : `${emoji} Demerit issued — ${studentName}`;

  // Insert in-app notification (parents' bell icon)
  const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
    student_id: record.student_id,
    title,
    body: `${record.description}${record.severity ? ` (Severity: ${record.severity})` : ""}`,
    type: record.type === "merit" ? "success" : "warning",
    is_read: false,
  });

  if (notifErr) return { success: false, message: "Failed to notify parent." };

  // Mark as notified
  await supabaseAdmin
    .from("student_conduct")
    .update({ parent_notified: true })
    .eq("id", recordId);

  revalidatePath("/teacher/conduct");
  revalidatePath("/parent");
  return { success: true, message: "Parent notified." };
}

// ── Fetch records for teacher's grades ───────────────────────────────────────

export async function fetchConductRecordsAction(
  grades: string[],
  academicYear: number = 2026,
  term: number = 1,
): Promise<ConductRecord[]> {
  if (grades.length === 0) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("student_conduct")
    .select("*, students ( full_name )")
    .in("grade", grades)
    .eq("academic_year", academicYear)
    .eq("term", term)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[fetchConductRecordsAction]", error.message);
    return [];
  }

  return (data ?? []).map((r) => ({
    ...r,
    student_name:
      (r as unknown as { students: { full_name: string } | null }).students
        ?.full_name ?? "Unknown",
  })) as ConductRecord[];
}
