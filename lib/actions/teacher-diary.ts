"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DiaryActionState } from "@/lib/types/diary";

// ── Validation schemas ────────────────────────────────────────────────────────

const classWideSchema = z.object({
  class_id: z.string().uuid("Invalid class selection"),
  entry_type: z.enum(["homework", "notice"] as const),
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().max(2000).optional().nullable(),
  subject_name: z.string().min(1, "Subject is required").max(100),
  due_date: z.string().optional().nullable(),
});

const observationSchema = z.object({
  student_id: z.string().uuid("Please select a student"),
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().max(2000).optional().nullable(),
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function getAuthContext() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

// ── Create class-wide entry (homework or notice) ──────────────────────────────

export async function createClassDiaryEntryAction(
  _prev: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const { user, supabase } = await getAuthContext();
  if (!user) return { success: false, message: "Not authenticated." };

  const raw = {
    class_id: formData.get("class_id"),
    entry_type: formData.get("entry_type"),
    title: formData.get("title"),
    subject_name: formData.get("subject_name"),
    content: (formData.get("content") as string) || null,
    due_date: (formData.get("due_date") as string) || null,
  };

  const parsed = classWideSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please check the form for errors.",
      errors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path[0], i.message])
      ) as DiaryActionState["errors"],
    };
  }

  const { error } = await supabase.from("student_diary").insert({
    class_id: parsed.data.class_id,
    author_id: user.id, // Professional implementation tracks the creator
    entry_type: parsed.data.entry_type,
    title: parsed.data.title,
    subject_name: parsed.data.subject_name,
    content: parsed.data.content,
    due_date: parsed.data.due_date,
    student_id: null, // Explicitly null for class-wide
    is_completed: false,
  });

  if (error) {
    console.error("[createClassDiaryEntry]", error.message);
    return { success: false, message: "Database error. Could not post entry." };
  }

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");

  return { 
    success: true, 
    message: `${parsed.data.entry_type === "homework" ? "Homework" : "Notice"} posted successfully.` 
  };
}

// ── Create individual observation ─────────────────────────────────────────────

export async function createObservationAction(
  _prev: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const { user, supabase } = await getAuthContext();
  if (!user) return { success: false, message: "Not authenticated." };

  const raw = {
    student_id: formData.get("student_id"),
    title: formData.get("title"),
    content: (formData.get("content") as string) || null,
  };

  const parsed = observationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: "Check observation details.",
      errors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path[0], i.message])
      ) as DiaryActionState["errors"],
    };
  }

  const { error } = await supabase.from("student_diary").insert({
    student_id: parsed.data.student_id,
    author_id: user.id,
    entry_type: "observation",
    title: parsed.data.title,
    content: parsed.data.content,
    class_id: null, // Explicitly null for individual observations
    is_completed: false,
  });

  if (error) {
    console.error("[createObservation]", error.message);
    return { success: false, message: "Failed to record observation." };
  }

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return { success: true, message: "Observation recorded." };
}

// ── Update existing entry ─────────────────────────────────────────────────────

export async function updateDiaryEntryAction(
  _prev: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const { user, supabase } = await getAuthContext();
  if (!user) return { success: false, message: "Not authenticated." };

  const entryId = formData.get("entry_id") as string;
  const updates = {
    title: (formData.get("title") as string)?.trim(),
    content: (formData.get("content") as string) || null,
    subject_name: (formData.get("subject_name") as string) || null,
    due_date: (formData.get("due_date") as string) || null,
  };

  if (!entryId) return { success: false, message: "Missing entry reference." };

  const { error } = await supabase
    .from("student_diary")
    .update(updates)
    .eq("id", entryId)
    .eq("author_id", user.id); // Security: Only author can update

  if (error) return { success: false, message: "Update failed." };

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return { success: true, message: "Entry updated." };
}

// ── Toggle homework completion ────────────────────────────────────────────────

export async function toggleHomeworkCompleteAction(
  _prev: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const { user, supabase } = await getAuthContext();
  if (!user) return { success: false, message: "Not authenticated." };

  const entryId = formData.get("entry_id") as string;
  const completed = formData.get("completed") === "true";

  const { error } = await supabase
    .from("student_diary")
    .update({ is_completed: completed })
    .eq("id", entryId);

  if (error) return { success: false, message: "Status update failed." };

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return { success: true, message: completed ? "Submitted." : "Pending." };
}

// ── Delete entry ──────────────────────────────────────────────────────────────

export async function deleteDiaryEntryAction(
  _prev: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const { user, supabase } = await getAuthContext();
  if (!user) return { success: false, message: "Not authenticated." };

  const entryId = formData.get("entry_id") as string;

  const { error } = await supabase
    .from("student_diary")
    .delete()
    .eq("id", entryId)
    .eq("author_id", user.id); // Security: Author only

  if (error) return { success: false, message: "Deletion failed." };

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return { success: true, message: "Entry removed." };
}