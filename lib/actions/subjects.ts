"use server";

// lib/actions/subjects.ts

import { getSession } from "@/lib/actions/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Subject } from "@/lib/data/subjects";

// ── Types ────────────────────────────────────────────────────────────────────

export type ActionResponse<T = unknown> = 
  | { success: true; data?: T; error?: never }
  | { success: false; error: string; data?: never };

export interface SubjectActionResult {
  success: boolean;
  message: string;
  id?: string;
  count?: number;
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
  knec_learning_area: z.string().max(200).nullable().optional(),
});

// ── Guard ─────────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session || !session.profile) {
    throw new Error("Forbidden");
  }

  const { base_role, is_super_admin, is_dev, school_id } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  if (base_role !== "admin" && !isPlatformAdmin) {
    throw new Error("Forbidden");
  }

  if (!school_id) {
    throw new Error("No school associated with this account.");
  }

  return school_id as string;
}

// ── Dashboard Layout Adaptors (The Missing Links) ───────────────────────────

/**
 * Deletes a subject belonging to a specific school (dashboard inline UI proxy)
 */
export async function deleteSubject(
  subjectId: string, 
  schoolId: string
): Promise<ActionResponse> {
  try {
    // Call the original action function using the parameters passed by the dashboard
    const result = await deleteSubjectAction(subjectId);
    
    if (!result.success) {
      return { success: false, error: result.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Dashboard deleteSubject wrapper exception:", error);
    return { success: false, error: "An unexpected error occurred during deletion." };
  }
}

/**
 * Bulk imports standard Kenyan CBC curriculum templates for a school (dashboard UI proxy)
 */
export async function bulkImportCbcTemplate(
  schoolId: string
): Promise<ActionResponse<{ count: number }>> {
  try {
    const result = await bulkImportCbcTemplateAction();

    if (!result.success) {
      return { success: false, error: result.message };
    }

    return { 
      success: true, 
      data: { count: result.count ?? 26 } 
    };
  } catch (error) {
    console.error("Dashboard bulkImportCbcTemplate wrapper exception:", error);
    return { success: false, error: "An unexpected error occurred during template import." };
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createSubjectAction(
  formData: FormData,
): Promise<SubjectActionResult> {
  let schoolId: string;
  try {
    schoolId = await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  const raw = {
    name: formData.get("name"),
    code: formData.get("code"),
    level: formData.get("level"),
    weekly_lessons: formData.get("weekly_lessons"),
    knec_learning_area: formData.get("knec_learning_area") || null,
  };

  const parsed = subjectSchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };

  const { data, error } = await supabaseAdmin
    .from("subjects")
    .insert({
      school_id: schoolId,
      name: parsed.data.name,
      code: parsed.data.code,
      level: parsed.data.level,
      weekly_lessons: parsed.data.weekly_lessons,
      knec_learning_area: parsed.data.knec_learning_area ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        message: `Subject code "${parsed.data.code}" already exists in your school.`,
      };
    }
    console.error("[createSubject]", error.message);
    return { success: false, message: "Failed to create subject." };
  }

  revalidatePath("/admin/allocation");
  revalidatePath("/dashboard/subjects");
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
  let schoolId: string;
  try {
    schoolId = await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  const raw = {
    name: formData.get("name"),
    code: formData.get("code"),
    level: formData.get("level"),
    weekly_lessons: formData.get("weekly_lessons"),
    knec_learning_area: formData.get("knec_learning_area") || null,
  };

  const parsed = subjectSchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };

  const { error } = await supabaseAdmin
    .from("subjects")
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
      level: parsed.data.level,
      weekly_lessons: parsed.data.weekly_lessons,
      knec_learning_area: parsed.data.knec_learning_area ?? null,
    })
    .eq("id", id)
    .eq("school_id", schoolId);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        message: `Subject code "${parsed.data.code}" is already used by another subject in your school.`,
      };
    }
    console.error("[updateSubject]", error.message);
    return { success: false, message: "Failed to update subject." };
  }

  revalidatePath("/admin/allocation");
  revalidatePath("/dashboard/subjects");
  return { success: true, message: `"${parsed.data.name}" updated.` };
}

// ── Delete Internal Action ────────────────────────────────────────────────────

export async function deleteSubjectAction(
  id: string,
): Promise<SubjectActionResult> {
  let schoolId: string;
  try {
    schoolId = await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

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

  const { error } = await supabaseAdmin
    .from("subjects")
    .delete()
    .eq("id", id)
    .eq("school_id", schoolId);

  if (error) {
    console.error("[deleteSubject]", error.message);
    return { success: false, message: "Failed to delete subject." };
  }

  revalidatePath("/admin/allocation");
  revalidatePath("/dashboard/subjects");
  return { success: true, message: "Subject deleted." };
}

// ── Bulk Import Template & Action ─────────────────────────────────────────────

interface CbcTemplateSubject {
  name: string;
  code: string;
  level: "lower_primary" | "upper_primary" | "junior_secondary";
  weekly_lessons: number;
  knec_learning_area: string | null;
}

const CBC_TEMPLATE_SUBJECTS: CbcTemplateSubject[] = [
  // Lower Primary
  { name: "Mathematics", code: "MAT-LP", level: "lower_primary", weekly_lessons: 5, knec_learning_area: "Mathematical Activities" },
  { name: "English Language", code: "ENG-LP", level: "lower_primary", weekly_lessons: 5, knec_learning_area: "Language Activities" },
  { name: "Kiswahili", code: "KSW-LP", level: "lower_primary", weekly_lessons: 5, knec_learning_area: "Kiswahili Language Activities" },
  { name: "Environmental Activities", code: "ENV-LP", level: "lower_primary", weekly_lessons: 3, knec_learning_area: "Environmental Activities" },
  { name: "Creative Arts", code: "CRA-LP", level: "lower_primary", weekly_lessons: 3, knec_learning_area: "Creative Arts Activities" },
  { name: "Religious Education", code: "CRE-LP", level: "lower_primary", weekly_lessons: 2, knec_learning_area: "Religious Education Activities" },
  { name: "Physical & Health Education", code: "PHE-LP", level: "lower_primary", weekly_lessons: 3, knec_learning_area: "Physical and Health Education" },
  // Upper Primary
  { name: "Mathematics", code: "MAT-UP", level: "upper_primary", weekly_lessons: 5, knec_learning_area: "Mathematics" },
  { name: "English Language", code: "ENG-UP", level: "upper_primary", weekly_lessons: 5, knec_learning_area: "English" },
  { name: "Kiswahili", code: "KSW-UP", level: "upper_primary", weekly_lessons: 5, knec_learning_area: "Kiswahili" },
  { name: "Science and Technology", code: "SCI-UP", level: "upper_primary", weekly_lessons: 4, knec_learning_area: "Integrated Science" },
  { name: "Social Studies", code: "SST-UP", level: "upper_primary", weekly_lessons: 3, knec_learning_area: "Social Studies" },
  { name: "Creative Arts and Sports", code: "CAS-UP", level: "upper_primary", weekly_lessons: 3, knec_learning_area: "Creative Arts and Sports" },
  { name: "Religious Education", code: "CRE-UP", level: "upper_primary", weekly_lessons: 2, knec_learning_area: "Religious Education" },
  { name: "Agriculture", code: "AGR-UP", level: "upper_primary", weekly_lessons: 2, knec_learning_area: "Agriculture" },
  // Junior Secondary
  { name: "Mathematics", code: "MAT-JS", level: "junior_secondary", weekly_lessons: 5, knec_learning_area: "Mathematics" },
  { name: "English Language", code: "ENG-JS", level: "junior_secondary", weekly_lessons: 5, knec_learning_area: "English" },
  { name: "Kiswahili", code: "KSW-JS", level: "junior_secondary", weekly_lessons: 5, knec_learning_area: "Kiswahili" },
  { name: "Integrated Science", code: "SCI-JS", level: "junior_secondary", weekly_lessons: 4, knec_learning_area: "Integrated Science" },
  { name: "Social Studies", code: "SST-JS", level: "junior_secondary", weekly_lessons: 3, knec_learning_area: "Social Studies" },
  { name: "Business Studies", code: "BST-JS", level: "junior_secondary", weekly_lessons: 3, knec_learning_area: "Business Studies" },
  { name: "Agriculture", code: "AGR-JS", level: "junior_secondary", weekly_lessons: 3, knec_learning_area: "Agriculture" },
  { name: "Creative Arts", code: "CRA-JS", level: "junior_secondary", weekly_lessons: 2, knec_learning_area: "Creative Arts" },
  { name: "Physical & Health Education", code: "PHE-JS", level: "junior_secondary", weekly_lessons: 3, knec_learning_area: "Physical and Health Education" },
  { name: "Religious Education", code: "CRE-JS", level: "junior_secondary", weekly_lessons: 2, knec_learning_area: "Religious Education" },
  { name: "Computer Science", code: "CSC-JS", level: "junior_secondary", weekly_lessons: 3, knec_learning_area: "Computer Science" },
];

export async function bulkImportCbcTemplateAction(): Promise<SubjectActionResult> {
  let schoolId: string;
  try {
    schoolId = await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  const rows = CBC_TEMPLATE_SUBJECTS.map((subject) => ({
    school_id: schoolId,
    name: subject.name,
    code: subject.code,
    level: subject.level,
    weekly_lessons: subject.weekly_lessons,
    knec_learning_area: subject.knec_learning_area,
  }));

  const { data: inserted, error } = await supabaseAdmin
    .from("subjects")
    .insert(rows)
    .select("id");

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        message:
          "Some CBC template subjects already exist for your school. Clear existing subjects or remove duplicates before importing.",
      };
    }
    console.error("[bulkImportCbcTemplate]", error.message);
    return { success: false, message: "Failed to import CBC template." };
  }

  revalidatePath("/admin/allocation");
  revalidatePath("/dashboard/subjects");
  return {
    success: true,
    message: `Successfully imported ${inserted?.length ?? rows.length} CBC subjects.`,
    count: inserted?.length ?? rows.length,
  };
}