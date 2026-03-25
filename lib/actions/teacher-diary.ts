"use server";
// lib/actions/teacher-diary.ts
// Replace the diary section of your existing teacher.ts actions file,
// OR import from here and re-export.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DiaryEntryType } from "../types/diary";

export interface ActionResult {
  success: boolean;
  message: string;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const classWideSchema = z.object({
  grade: z.string().min(1, "Grade is required"),
  entry_type: z.enum(["homework", "notice"]),
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
});

const observationSchema = z.object({
  grade: z.string().min(1, "Grade is required"),
  student_id: z.string().uuid("Invalid student"),
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().optional().nullable(),
});

// ── Create ────────────────────────────────────────────────────────────────────

export async function createClassDiaryEntryAction(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const raw = {
    grade: formData.get("grade"),
    entry_type: formData.get("entry_type"),
    title: formData.get("title"),
    content: formData.get("content") || null,
    due_date: formData.get("due_date") || null,
  };

  const parsed = classWideSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  // Homework must have due_date (soft warning — we allow null for flexibility)
  const { error } = await supabase.from("student_diary").insert({
    grade: parsed.data.grade,
    entry_type: parsed.data.entry_type,
    student_id: null, // explicitly null — class-wide
    title: parsed.data.title,
    content: parsed.data.content ?? null,
    homework: parsed.data.entry_type === "homework", // keep legacy column in sync
    due_date: parsed.data.due_date ?? null,
    is_completed: false,
  });

  if (error) {
    console.error("[createClassDiaryEntryAction]", error.message);
    return { success: false, message: "Failed to save entry." };
  }

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return {
    success: true,
    message: `${parsed.data.entry_type === "homework" ? "Homework" : "Notice"} posted to ${parsed.data.grade}.`,
  };
}

export async function createObservationAction(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const raw = {
    grade: formData.get("grade"),
    student_id: formData.get("student_id"),
    title: formData.get("title"),
    content: formData.get("content") || null,
  };

  const parsed = observationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { error } = await supabase.from("student_diary").insert({
    grade: parsed.data.grade,
    entry_type: "observation",
    student_id: parsed.data.student_id,
    title: parsed.data.title,
    content: parsed.data.content ?? null,
    homework: false,
    due_date: null,
    is_completed: false,
  });

  if (error) {
    console.error("[createObservationAction]", error.message);
    return { success: false, message: "Failed to save observation." };
  }

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return { success: true, message: "Observation recorded." };
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateDiaryEntryAction(
  entryId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const entryType = formData.get("entry_type") as DiaryEntryType;

  const updates: Record<string, unknown> = {
    title: formData.get("title") as string,
    content: (formData.get("content") as string) || null,
  };

  if (entryType === "homework") {
    updates.due_date = (formData.get("due_date") as string) || null;
  }

  const { error } = await supabase
    .from("student_diary")
    .update(updates)
    .eq("id", entryId);

  if (error) return { success: false, message: "Failed to update entry." };

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return { success: true, message: "Entry updated." };
}

// ── Toggle completed (teacher marks student handed in work) ───────────────────

export async function toggleHomeworkCompleteAction(
  entryId: string,
  completed: boolean,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return { success: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("student_diary")
    .update({ is_completed: completed })
    .eq("id", entryId);

  if (error) {
    console.error("[toggleHomeworkCompleteAction]", error.message);
    return { success: false, message: "Failed to update." };
  }

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return {
    success: true,
    message: completed ? "Marked as submitted." : "Marked as pending.",
  };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteDiaryEntryAction(
  entryId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return { success: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("student_diary")
    .delete()
    .eq("id", entryId);

  if (error) {
    console.error("[deleteDiaryEntryAction]", error.message);
    return { success: false, message: "Failed to delete entry." };
  }

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return { success: true, message: "Entry deleted." };
}
