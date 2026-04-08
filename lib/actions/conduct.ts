"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";
// Import ONLY what we need for logic
import {
  conductSchema,
  type ActionState,
  type ConductCategory,
  type ConductData,
  type ConductInput,
  type ConductType,
  type Severity,
} from "@/lib/schemas/conduct";

// ── REMOVED RE-EXPORTS ────────────────────────────────────────────────────────
// Do not export types/interfaces from "use server" files.
// Components should import these from @/lib/schemas/conduct instead.

// ── Public interfaces (Can stay if NOT exported, or move to schema file) ──────
// NOTE: I am keeping these here but ensuring they are used for internal typing. 
// If you need ConductRecord in your components, move this definition to @/lib/schemas/conduct.
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

interface StudentNameJoin {
  full_name: string;
}

// ── Create record ─────────────────────────────────────────────────────────────

export async function createConductRecordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { status: "error", message: "Not authenticated.", fieldErrors: {} };
  }

  const raw: ConductInput = {
    student_id: formData.get("student_id") as string,
    grade: formData.get("grade") as string,
    stream: formData.get("stream") as string,
    academic_year: formData.get("academic_year") as string,
    term: formData.get("term") as string,
    type: formData.get("type") as ConductType, 
    category: formData.get("category") as ConductCategory,
    points: formData.get("points") as string,
    description: formData.get("description") as string,
    action_taken: (formData.get("action_taken") as string) || null,
    severity: (formData.get("severity") as Severity) || null,
  };

  const parsed = conductSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Partial<Record<keyof ConductData, string[]>>,
    };
  }

  const d = parsed.data;

  const { data: studentRow } = await supabase
    .from("students")
    .select("full_name")
    .eq("id", d.student_id)
    .single<StudentNameJoin>();

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
    message: `${TYPE_LABELS[d.type]} record saved for ${studentName}.`,
    id: record.id,
    data: d,
    studentName,
  };
}

// ── Update record ─────────────────────────────────────────────────────────────

export async function updateConductRecordAction(
  id: string,
  patch: Partial<Pick<ConductRecord, "action_taken" | "is_resolved">>,
): Promise<SimpleActionResult> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  interface RecordWithStudent extends Pick<ConductRecord, 'id'|'student_id'|'type'|'description'|'severity'> {
    students: StudentNameJoin | null;
  }

  const { data: record, error: fetchErr } = await supabaseAdmin
    .from("student_conduct")
    .select("id, student_id, type, description, severity, students ( full_name )")
    .eq("id", recordId)
    .single<RecordWithStudent>();

  if (fetchErr || !record) return { success: false, message: "Record not found." };

  const studentName = record.students?.full_name ?? "your child";
  const emoji = record.type === "merit" ? "🏅" : record.type === "incident" ? "⚠️" : "📋";
  
  const title = record.type === "merit"
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

export async function fetchConductRecordsAction(
  grades: string[],
  academicYear: number = 2026,
  term: number = 1,
): Promise<ConductRecord[]> {
  if (grades.length === 0) return [];
  const supabase = await createSupabaseServerClient();

  interface RawConductRow extends Omit<ConductRecord, 'student_name'> {
    students: StudentNameJoin | null;
  }

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

  const rows = (data as unknown) as RawConductRow[];

  return rows.map((row): ConductRecord => ({
    ...row,
    student_name: row.students?.full_name ?? "Unknown",
  }));
}

// ── Logic Helpers ───────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ConductType, string> = {
  merit: "Merit",
  demerit: "Demerit",
  incident: "Incident",
};

function signedPoints(type: ConductType, raw: number): number {
  if (type === "merit") return Math.abs(raw);
  if (type === "demerit") return -Math.abs(raw);
  return 0;
}