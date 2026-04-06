"use server";
// lib/actions/teacher-diary.ts
// All server actions use the (prevState, formData) => DiaryActionState signature
// so they work directly with React 19's useActionState hook.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DiaryActionState } from "@/lib/types/diary";

// ── Validation schemas ────────────────────────────────────────────────────────

const classWideSchema = z.object({
  grade: z.string().min(1, "Class is required"),
  entry_type: z.enum(["homework", "notice"] as const, {
    message: "Entry type is required",
  }),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z.string().max(2000).optional().nullable(),
  due_date: z.string().optional().nullable(),
});

const observationSchema = z.object({
  grade: z.string().min(1, "Class is required"),
  student_id: z.string().uuid("Please select a student"),
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  content: z.string().max(2000).optional().nullable(),
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { user: null, supabase };
  return { user, supabase };
}

// ── Create class-wide entry (homework or notice) ──────────────────────────────

export async function createClassDiaryEntryAction(
  _prev: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const { user, supabase } = await getAuthUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const raw = {
    grade: formData.get("grade"),
    entry_type: formData.get("entry_type"),
    title: formData.get("title"),
    content: (formData.get("content") as string) || null,
    due_date: (formData.get("due_date") as string) || null,
  };

  const parsed = classWideSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      message: first?.message ?? "Invalid input",
      errors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path[0], i.message]),
      ) as DiaryActionState["errors"],
    };
  }

  const { error } = await supabase.from("student_diary").insert({
    grade: parsed.data.grade,
    entry_type: parsed.data.entry_type,
    student_id: null,
    title: parsed.data.title,
    content: parsed.data.content ?? null,
    homework: parsed.data.entry_type === "homework",
    due_date: parsed.data.due_date ?? null,
    is_completed: false,
  });

  if (error) {
    console.error("[createClassDiaryEntry]", error.message);
    return {
      success: false,
      message: "Failed to save entry. Please try again.",
    };
  }

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");

  const label = parsed.data.entry_type === "homework" ? "Homework" : "Notice";
  return { success: true, message: `${label} posted to ${parsed.data.grade}.` };
}

// ── Create individual observation ─────────────────────────────────────────────

export async function createObservationAction(
  _prev: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const { user, supabase } = await getAuthUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const raw = {
    grade: formData.get("grade"),
    student_id: formData.get("student_id"),
    title: formData.get("title"),
    content: (formData.get("content") as string) || null,
  };

  const parsed = observationSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      success: false,
      message: first?.message ?? "Invalid input",
      errors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path[0], i.message]),
      ) as DiaryActionState["errors"],
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
    console.error("[createObservation]", error.message);
    return { success: false, message: "Failed to save observation." };
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
  const { user, supabase } = await getAuthUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const entryId = formData.get("entry_id") as string;
  const entryType = formData.get("entry_type") as string;
  const title = (formData.get("title") as string)?.trim();
  const content = (formData.get("content") as string) || null;

  if (!entryId) return { success: false, message: "Entry ID missing." };
  if (!title)
    return {
      success: false,
      message: "Title is required.",
      errors: { title: "Title is required" },
    };

  const updates: Record<string, unknown> = { title, content };
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

// ── Toggle homework completion ────────────────────────────────────────────────

export async function toggleHomeworkCompleteAction(
  _prev: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const { user, supabase } = await getAuthUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const entryId = formData.get("entry_id") as string;
  const completed = formData.get("completed") === "true";

  if (!entryId) return { success: false, message: "Entry ID missing." };

  const { error } = await supabase
    .from("student_diary")
    .update({ is_completed: completed })
    .eq("id", entryId);

  if (error) return { success: false, message: "Failed to update." };

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return {
    success: true,
    message: completed ? "Marked as submitted." : "Marked as pending.",
  };
}

// ── Delete entry ──────────────────────────────────────────────────────────────

export async function deleteDiaryEntryAction(
  _prev: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const { user, supabase } = await getAuthUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const entryId = formData.get("entry_id") as string;
  if (!entryId) return { success: false, message: "Entry ID missing." };

  const { error } = await supabase
    .from("student_diary")
    .delete()
    .eq("id", entryId);

  if (error) return { success: false, message: "Failed to delete entry." };

  revalidatePath("/teacher/diary");
  revalidatePath("/parent");
  return { success: true, message: "Entry deleted." };
}
