"use server";
// lib/actions/conduct.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  conductSchema,
  type ActionState,
  type ConductCategory,
  type ConductData,
  type ConductInput,
  type ConductType,
  type Severity,
} from "@/lib/schemas/conduct";

// ── Re-exports ────────────────────────────────────────────────────────────────
// Components import types from here so they only need one import path.

export type { ActionState, ConductType, ConductCategory, Severity };

// ── Public types ──────────────────────────────────────────────────────────────

export interface ConductRecord {
  id: string;
  student_id: string;
  student_name: string;
  teacher_id: string;
  grade: string;
  stream: string;
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

export interface SimpleActionResult {
  success: boolean;
  message: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function signedPoints(type: ConductType, raw: number): number {
  if (type === "merit") return Math.abs(raw);
  if (type === "demerit") return -Math.abs(raw);
  return 0;
}

// ── Create record ─────────────────────────────────────────────────────────────
// Signature matches useActionState: (prevState, formData) => Promise<ActionState>

export async function createConductRecordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { status: "error", message: "Not authenticated.", fieldErrors: {} };
  }

  const raw: ConductInput = {
    student_id: formData.get("student_id") as string,
    grade: formData.get("grade") as string,
    stream: formData.get("stream") as string,
    academic_year: formData.get("academic_year") as string,
    term: formData.get("term") as string,
    type: formData.get("type") as string,
    category: formData.get("category") as string,
    points: formData.get("points") as string,
    description: formData.get("description") as string,
    action_taken: (formData.get("action_taken") as string) || null,
    severity: (formData.get("severity") as string) || null,
  };

  const parsed = conductSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Partial<
        Record<keyof ConductData, string[]>
      >,
    };
  }

  const d = parsed.data;

  // Fetch the student name once so the action can echo it back for optimistic UI.
  const { data: studentRow } = await supabase
    .from("students")
    .select("full_name")
    .eq("id", d.student_id)
    .single<{ full_name: string }>();

  const studentName = studentRow?.full_name ?? "Unknown";

  const { data: record, error: insertErr } = await supabase
    .from("student_conduct")
    .insert({
      student_id: d.student_id,
      teacher_id: user.id,
      grade: d.grade,
      stream: d.stream,
      academic_year: d.academic_year,
      term: d.term,
      type: d.type,
      category: d.category,
      points: signedPoints(d.type, d.points),
      description: d.description,
      action_taken: d.action_taken ?? null,
      severity: d.type === "incident" ? (d.severity ?? "low") : null,
      parent_notified: false,
      is_resolved: false,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !record) {
    console.error("[createConductRecordAction]", insertErr?.message);
    return {
      status: "error",
      message: "Failed to save record. Please try again.",
      fieldErrors: {},
    };
  }

  revalidatePath("/teacher/conduct");
  revalidatePath("/parent");

  return {
    status: "success",
    message: `${TYPE_LABELS[d.type]} record saved.`,
    id: record.id,
    data: d,
    studentName,
  };
}

const TYPE_LABELS: Record<ConductType, string> = {
  merit: "Merit",
  demerit: "Demerit",
  incident: "Incident",
};

// ── Update record ─────────────────────────────────────────────────────────────

export async function updateConductRecordAction(
  id: string,
  patch: Partial<Pick<ConductRecord, "action_taken" | "is_resolved">>,
): Promise<SimpleActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return { success: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("student_conduct")
    .update(patch)
    .eq("id", id)
    .eq("teacher_id", user.id);

  if (error) return { success: false, message: "Failed to update." };
  revalidatePath("/teacher/conduct");
  return { success: true, message: "Record updated." };
}

// ── Delete record ─────────────────────────────────────────────────────────────

export async function deleteConductRecordAction(
  id: string,
): Promise<SimpleActionResult> {
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
): Promise<SimpleActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user)
    return { success: false, message: "Not authenticated." };

  type RecordRow = {
    id: string;
    student_id: string;
    type: ConductType;
    description: string;
    severity: Severity | null;
    students: { full_name: string } | null;
  };

  const { data: record, error: fetchErr } = await supabaseAdmin
    .from("student_conduct")
    .select(
      "id, student_id, type, description, severity, students ( full_name )",
    )
    .eq("id", recordId)
    .single<RecordRow>();

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

  const { error: notifErr } = await supabaseAdmin.from("notifications").insert({
    student_id: record.student_id,
    title,
    body: `${record.description}${record.severity ? ` (Severity: ${record.severity})` : ""}`,
    type: record.type === "merit" ? "success" : "warning",
    is_read: false,
  });

  if (notifErr) return { success: false, message: "Failed to notify parent." };

  await supabaseAdmin
    .from("student_conduct")
    .update({ parent_notified: true })
    .eq("id", recordId);

  revalidatePath("/teacher/conduct");
  revalidatePath("/parent");
  return { success: true, message: "Parent notified." };
}

// ── Fetch records ─────────────────────────────────────────────────────────────
// Queries by grade strings — matches the original action's data shape.
// If you migrate to class_id FK on student_conduct, swap .in("grade", grades)
// for .in("class_id", classIds) and update the caller accordingly.

export async function fetchConductRecordsAction(
  grades: string[],
  academicYear: number = 2026,
  term: number = 1,
): Promise<ConductRecord[]> {
  if (grades.length === 0) return [];

  const supabase = await createSupabaseServerClient();

  type RawRow = Omit<ConductRecord, "student_name"> & {
    students: { full_name: string } | null;
  };

  const { data, error } = await supabase
    .from("student_conduct")
    .select("*, students ( full_name )")
    .in("grade", grades)
    .eq("academic_year", academicYear)
    .eq("term", term)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<RawRow[]>();

  if (error) {
    console.error("[fetchConductRecordsAction]", error.message);
    return [];
  }

  return (data ?? []).map(
    ({ students, ...rest }): ConductRecord => ({
      ...rest,
      student_name: students?.full_name ?? "Unknown",
    }),
  );
}
