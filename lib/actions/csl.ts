// ============================================================
// lib/actions/csl.ts
// Server actions: CSL Logbook entries + Transfer workflow
// ============================================================
"use server";

import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InboundScanInput } from "@/types/csl";
import { CORE_COMPETENCIES, CSL_STRANDS } from "@/types/csl";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Shared result ─────────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  message: string;
  id?: string;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const cslEntrySchema = z.object({
  studentId: z.string().uuid(),
  academicYear: z.number().int().min(2020).max(2030).default(2026),
  projectTitle: z.string().min(3).max(200),
  strand: z.enum(CSL_STRANDS),
  activityDescription: z.string().min(10).max(2000),
  hoursSpent: z.number().int().min(1).max(40),
  competenciesAddressed: z.array(z.enum(CORE_COMPETENCIES)).min(1),
  studentReflection: z.string().min(20).max(3000),
  evidenceUrl: z.string().url().optional().or(z.literal("")),
});

const supervisorReviewSchema = z.object({
  entryId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  supervisorNotes: z.string().max(500).optional(),
});

const outboundTransferSchema = z.object({
  studentId: z.string().uuid(),
  destinationSchool: z.string().min(2).max(200),
  reason: z.string().min(5).max(500),
});

// NOTE: This schema validates the QR payload that arrives from a *source school*.
// The source school only knows the student's grade as a display string (e.g. "Grade 7").
// It does NOT contain a class_id, because that UUID belongs to this school's
// classes table. The mapping from source grade → local class_id is resolved by
// the admin at approval time (see approveInboundTransferAction).
const inboundScanSchema = z.object({
  upi: z.string().min(1),
  assessment_number: z.string().nullable(),
  full_name: z.string().min(2),
  // Grade string from the source school — kept as-is for the audit trail.
  current_grade: z.string().min(1),
  current_school_code: z.string().min(1),
  generated_at: z.string().datetime(),
});

// ── CSL: Save a log entry ─────────────────────────────────────────────────────

export async function saveCSLEntryAction(
  values: z.infer<typeof cslEntrySchema>,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { success: false, message: "Not authenticated" };

  const parsed = cslEntrySchema.safeParse(values);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation error",
    };
  }

  const v = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("csl_logbook")
    .insert({
      student_id: v.studentId,
      academic_year: v.academicYear,
      project_title: v.projectTitle,
      strand: v.strand,
      activity_description: v.activityDescription,
      hours_spent: v.hoursSpent,
      competencies_addressed: v.competenciesAddressed,
      student_reflection: v.studentReflection,
      evidence_url: v.evidenceUrl || null,
      supervisor_status: "pending",
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    console.error("[saveCSLEntry]", error.message);
    return {
      success: false,
      message: "Failed to save entry. Please try again.",
    };
  }

  revalidatePath("/admin/csl");
  return {
    success: true,
    message: "CSL entry saved successfully.",
    id: data.id,
  };
}

// ── CSL: Supervisor review ────────────────────────────────────────────────────

export async function reviewCSLEntryAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !["admin", "teacher"].includes(session.profile.role)) {
    return { success: false, message: "Unauthorised" };
  }

  const parsed = supervisorReviewSchema.safeParse({
    entryId: formData.get("entryId"),
    status: formData.get("status"),
    supervisorNotes: formData.get("supervisorNotes") ?? undefined,
  });
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation error",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("csl_logbook")
    .update({
      supervisor_status: parsed.data.status,
      supervisor_notes: parsed.data.supervisorNotes ?? null,
      supervisor_id: session.user.id,
    })
    .eq("id", parsed.data.entryId);

  if (error) {
    console.error("[reviewCSLEntry]", error.message);
    return { success: false, message: "Review failed." };
  }

  revalidatePath("/admin/csl");
  return { success: true, message: `Entry ${parsed.data.status}.` };
}

// ── Transfer: Initiate outbound ───────────────────────────────────────────────
// Records the student's current class_id in the transfer audit trail so the
// destination school (and our own history) knows exactly which class they left.

export async function initiateOutboundTransferAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin")
    return { success: false, message: "Unauthorised" };

  const parsed = outboundTransferSchema.safeParse({
    studentId: formData.get("studentId"),
    destinationSchool: formData.get("destinationSchool"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation error",
    };
  }

  const supabase = await createSupabaseServerClient();

  // Resolve the student's current class_id so it is captured on the transfer
  // record — the RPC uses it to set the student's status to transfer_pending
  // and to embed a denormalised grade label in the QR payload.
  const { data: studentRow, error: studentErr } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", parsed.data.studentId)
    .single<{ class_id: string | null }>();

  if (studentErr || !studentRow) {
    return { success: false, message: "Student not found." };
  }

  if (!studentRow.class_id) {
    return {
      success: false,
      message: "Student is not assigned to a class. Please assign them first.",
    };
  }

  const { data, error } = await supabase.rpc("initiate_outbound_transfer", {
    p_student_id: parsed.data.studentId,
    p_class_id: studentRow.class_id,
    p_initiated_by: session.user.id,
    p_destination: parsed.data.destinationSchool,
    p_reason: parsed.data.reason,
  });

  if (error) {
    console.error("[initiateOutbound]", error.message);
    return { success: false, message: "Transfer initiation failed." };
  }

  revalidatePath("/admin/transfers");
  revalidatePath("/admin/students");
  return {
    success: true,
    message: "Transfer initiated. Student status set to transfer pending.",
    id: data as string,
  };
}

// ── Transfer: Record inbound from QR scan ────────────────────────────────────
// Validates the QR payload from the source school and creates a pending
// transfer_request. Note: current_grade in the payload is the *source school's*
// grade string — it is stored for display/audit, not used to assign a class here.
// Class assignment happens at approval time (see approveInboundTransferAction).

export async function recordInboundScanAction(
  input: InboundScanInput,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin")
    return { success: false, message: "Unauthorised" };

  const parsed = inboundScanSchema.safeParse(input.payload);
  if (!parsed.success)
    return { success: false, message: "Invalid QR code data." };

  // Reject QR codes older than 30 days
  const generated = new Date(parsed.data.generated_at);
  const ageDays = (Date.now() - generated.getTime()) / 86400000;
  if (ageDays > 30) {
    return {
      success: false,
      message: "QR code has expired (older than 30 days).",
    };
  }

  const supabase = await createSupabaseServerClient();

  // Look up the student by UPI — they may already exist (prior enrolment here)
  // or be completely new. A null studentId is valid for the insert below.
  const { data: studentRow, error: sErr } = await supabase
    .from("students")
    .select("id, full_name, status")
    .eq("upi_number", parsed.data.upi)
    .maybeSingle<{ id: string; full_name: string; status: string }>();

  if (sErr) {
    console.error("[recordInbound]", sErr.message);
    return { success: false, message: "Student lookup failed." };
  }

  const studentId = studentRow?.id ?? null;

  const { data: reqData, error: reqErr } = await supabase
    .from("transfer_requests")
    .insert({
      student_id: studentId,
      direction: "inbound",
      status: "pending",
      source_school_code: parsed.data.current_school_code,
      source_upi: parsed.data.upi,
      source_assessment_no: parsed.data.assessment_number,
      // Preserve the source grade string verbatim for the admin's reference and
      // for the audit trail — it is NOT used to derive a local class_id.
      source_grade: parsed.data.current_grade,
      scanned_qr_payload: input.payload,
      initiated_by: session.user.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (reqErr) {
    console.error("[recordInbound insert]", reqErr.message);
    return { success: false, message: "Failed to record inbound request." };
  }

  revalidatePath("/admin/transfers");
  return {
    success: true,
    message: `Inbound transfer request created for ${parsed.data.full_name}.`,
    id: reqData.id,
  };
}

// ── Transfer: Approve inbound ─────────────────────────────────────────────────
// The admin selects the local class the student should be placed into.
// This class_id is passed to the RPC which:
//   1. Sets student.class_id = p_class_id
//   2. Sets student.status = "active"
//   3. Marks the transfer_request as approved
//   4. Restores any SBA history for that student

export async function approveInboundTransferAction(
  transferId: string,
  studentId: string,
  classId: string, // ← local classes.id selected by admin at approval time
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin")
    return { success: false, message: "Unauthorised" };

  // Validate that the supplied classId is a real UUID before hitting the DB.
  const classIdParsed = z.string().uuid("Invalid class ID.").safeParse(classId);
  if (!classIdParsed.success) {
    return {
      success: false,
      message: classIdParsed.error.issues[0]?.message ?? "Invalid class ID.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("approve_inbound_transfer", {
    p_transfer_id: transferId,
    p_student_id: studentId,
    p_class_id: classIdParsed.data, // ← new param; RPC sets student.class_id
    p_approved_by: session.user.id,
  });

  if (error) {
    console.error("[approveInbound]", error.message);
    return { success: false, message: "Approval failed. " + error.message };
  }

  revalidatePath("/admin/transfers");
  revalidatePath("/admin/students");
  revalidatePath("/admin/exams/grade-9");
  return { success: true, message: "Transfer approved. SBA history restored." };
}

// ── Transfer: Reject a request ───────────────────────────────────────────────

export async function rejectTransferAction(
  transferId: string,
  rejectionReason: string,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin")
    return { success: false, message: "Unauthorised" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("transfer_requests")
    .update({ status: "rejected", rejection_reason: rejectionReason })
    .eq("id", transferId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/transfers");
  return { success: true, message: "Transfer request rejected." };
}
