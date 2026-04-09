"use server";

// lib/actions/subjects.ts

import { getSession } from "@/lib/actions/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface SubjectActionResult {
  success: boolean;
  message: string;
  id?: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

const subjectSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20)
    .toUpperCase()
    .regex(
      /^[A-Z0-9_-]+$/,
      "Code must be uppercase letters, numbers, hyphens or underscores",
    ),
  level: z.enum(["lower_primary", "upper_primary", "junior_secondary"]),
  weekly_lessons: z.coerce.number().int().min(1).max(10),
});

// ── Guard ─────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role))
    throw new Error("Forbidden");
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createSubjectAction(
  formData: FormData,
): Promise<SubjectActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  const raw = {
    name: formData.get("name"),
    code: formData.get("code"),
    level: formData.get("level"),
    weekly_lessons: formData.get("weekly_lessons"),
  };

  const parsed = subjectSchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };

  // Check for duplicate code
  const { data: existing } = await supabaseAdmin
    .from("subjects")
    .select("id")
    .eq("code", parsed.data.code)
    .maybeSingle();

  if (existing)
    return {
      success: false,
      message: `Subject code "${parsed.data.code}" already exists.`,
    };

  const { data, error } = await supabaseAdmin
    .from("subjects")
    .insert({
      name: parsed.data.name,
      code: parsed.data.code,
      level: parsed.data.level,
      weekly_lessons: parsed.data.weekly_lessons,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createSubject]", error.message);
    return { success: false, message: "Failed to create subject." };
  }

  revalidatePath("/admin/allocation");
  return {
    success: true,
    message: `"${parsed.data.name}" added.`,
    id: data.id,
  };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateSubjectAction(
  id: string,
  formData: FormData,
): Promise<SubjectActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  const raw = {
    name: formData.get("name"),
    code: formData.get("code"),
    level: formData.get("level"),
    weekly_lessons: formData.get("weekly_lessons"),
  };

  const parsed = subjectSchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };

  // Check duplicate code on a different subject
  const { data: existing } = await supabaseAdmin
    .from("subjects")
    .select("id")
    .eq("code", parsed.data.code)
    .neq("id", id)
    .maybeSingle();

  if (existing)
    return {
      success: false,
      message: `Subject code "${parsed.data.code}" is used by another subject.`,
    };

  const { error } = await supabaseAdmin
    .from("subjects")
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
      level: parsed.data.level,
      weekly_lessons: parsed.data.weekly_lessons,
    })
    .eq("id", id);

  if (error) {
    console.error("[updateSubject]", error.message);
    return { success: false, message: "Failed to update subject." };
  }

  revalidatePath("/admin/allocation");
  return { success: true, message: `"${parsed.data.name}" updated.` };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteSubjectAction(
  id: string,
): Promise<SubjectActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  // Check if subject is in use by any allocation
  const { data: inUse } = await supabaseAdmin
    .from("teacher_subject_allocations")
    .select("id")
    .eq("subject_id", id)
    .limit(1)
    .maybeSingle();

  if (inUse)
    return {
      success: false,
      message:
        "Cannot delete — this subject is assigned to at least one teacher. Remove those allocations first.",
    };

  const { error } = await supabaseAdmin.from("subjects").delete().eq("id", id);

  if (error) {
    console.error("[deleteSubject]", error.message);
    return { success: false, message: "Failed to delete subject." };
  }

  revalidatePath("/admin/allocation");
  return { success: true, message: "Subject deleted." };
}
