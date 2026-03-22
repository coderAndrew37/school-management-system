"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// ── Shared result type ────────────────────────────────────────────────────────

interface ActionResult {
  success: boolean;
  message?: string;
}

interface PathwayResult extends ActionResult {
  guidance?: string;
}

// ── Send Message ──────────────────────────────────────────────────────────────

export async function sendMessageAction(
  formData: FormData,
): Promise<ActionResult> {
  const studentId = formData.get("student_id") as string;
  const body = formData.get("body") as string;
  const category = formData.get("category") as string;
  const subject = formData.get("subject") as string | null;
  const threadId = formData.get("thread_id") as string | null;
  const isReply = formData.get("is_reply") === "true";

  if (!body?.trim()) {
    return { success: false, message: "Message body is required" };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, message: "Unauthorized" };

  // Resolve sender display name from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single<{ full_name: string }>();

  // Verify the parent is actually linked to this student
  const { data: link, error: linkError } = await supabase
    .from("student_parents")
    .select("student_id")
    .eq("student_id", studentId)
    .eq("parent_id", user.id)
    .maybeSingle<{ student_id: string }>();

  if (linkError || !link) {
    return { success: false, message: "You are not linked to this student." };
  }

  const { error } = await supabase.from("communication_book").insert({
    student_id: studentId,
    sender_id: user.id,
    sender_name: profile?.full_name ?? "Parent",
    sender_role: "parent",
    category,
    subject: isReply ? null : subject,
    body,
    thread_id: isReply && threadId ? threadId : crypto.randomUUID(),
    is_read: false,
  });

  if (error) {
    console.error("[sendMessageAction]", error.message);
    return { success: false, message: "Failed to send message." };
  }

  revalidatePath(`/parent/portal/${studentId}`);
  return { success: true };
}

// ── Mark Thread as Read ───────────────────────────────────────────────────────

export async function markThreadAsReadAction(
  threadId: string,
  studentId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, message: "Unauthorized" };

  const { error } = await supabase
    .from("communication_book")
    .update({ is_read: true })
    .eq("thread_id", threadId)
    .neq("sender_id", user.id);

  if (error) {
    console.error("[markThreadAsReadAction]", error.message);
    return { success: false };
  }

  revalidatePath(`/parent/portal/${studentId}`);
  return { success: true };
}

// ── Save JSS Pathway ──────────────────────────────────────────────────────────

export async function saveJssPathwayAction(
  formData: FormData,
): Promise<PathwayResult> {
  const studentId = formData.get("student_id") as string;
  const studentName = formData.get("student_name") as string;
  const grade = formData.get("grade") as string;
  const learning_style = formData.get("learning_style") as string;
  const pathway_cluster = formData.get("pathway_cluster") as string;

  const interest_areas =
    formData.get("interest_areas")?.toString().split(",").filter(Boolean) ?? [];
  const strong_subjects =
    formData.get("strong_subjects")?.toString().split(",").filter(Boolean) ??
    [];
  const career_interests =
    formData.get("career_interests")?.toString().split(",").filter(Boolean) ??
    [];

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, message: "Unauthorized" };

  const aiGuidance = `Based on ${studentName}'s interest in ${interest_areas.slice(0, 2).join(" & ")} and strength in ${strong_subjects[0] ?? "core subjects"}, the ${pathway_cluster} cluster is an excellent fit. Suggest focusing on projects involving ${career_interests[0] ?? "their areas of interest"} to align with a ${learning_style} learning style.`;

  const { error } = await supabase.from("jss_pathways").upsert(
    {
      student_id: studentId,
      interest_areas,
      strong_subjects,
      career_interests,
      learning_style,
      pathway_cluster,
      ai_guidance: aiGuidance,
      guidance_date: new Date().toISOString().split("T")[0],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id" },
  );

  if (error) {
    console.error("[saveJssPathwayAction]", error.message);
    return { success: false, message: "Failed to save pathway guidance." };
  }

  revalidatePath(`/parent/portal/${studentId}`);
  return { success: true, guidance: aiGuidance };
}

// ── Mark Notifications Read ───────────────────────────────────────────────────

export async function markNotificationsReadAction(
  studentId: string,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { success: false, message: "Unauthorized" };

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("student_id", studentId)
    .eq("is_read", false);

  if (error) {
    console.error("[markNotificationsReadAction]", error.message);
    return { success: false, message: "Failed to update notifications." };
  }

  revalidatePath(`/parent/portal/${studentId}`);
  return { success: true };
}
