"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server"; // Ensure correct import
import { revalidatePath } from "next/cache";
import crypto from "crypto";

export async function sendMessageAction(formData: FormData) {
  // FIX 1: Add await here
  const supabase = await createSupabaseServerClient();

  const studentId = formData.get("student_id") as string;
  const body = formData.get("body") as string;
  const category = formData.get("category") as string;
  const subject = formData.get("subject") as string | null;
  const threadId = formData.get("thread_id") as string | null;
  const isReply = formData.get("is_reply") === "true";

  if (!body || body.length < 1) {
    return { success: false, message: "Message body is required" };
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: parent } = await supabase
      .from("parents")
      .select("full_name")
      .eq("email", user.email)
      .single();

    const finalThreadId = isReply && threadId ? threadId : crypto.randomUUID();

    const messageData = {
      student_id: studentId,
      sender_id: user.id,
      sender_name: parent?.full_name || "Parent",
      sender_role: "parent",
      category,
      subject: isReply ? null : subject,
      body,
      thread_id: finalThreadId,
      is_read: false,
    };

    const { error } = await supabase
      .from("communication_book")
      .insert(messageData);

    if (error) throw error;

    revalidatePath(`/parent/portal/${studentId}`);
    return { success: true };
  } catch (error: any) {
    console.error("sendMessageAction Error:", error);
    return {
      success: false,
      message: error.message || "Failed to send message.",
    };
  }
}

export async function markThreadAsReadAction(
  threadId: string,
  studentId: string,
) {
  // FIX 2: Use correct function name AND add await
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase
    .from("communication_book")
    .update({ is_read: true })
    .eq("thread_id", threadId)
    .neq("sender_id", user.id);

  if (error) return { success: false };

  revalidatePath(`/parent/portal/${studentId}`);
  return { success: true };
}

export async function saveJssPathwayAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const studentId = formData.get("student_id") as string;
  const studentName = formData.get("student_name") as string;
  const grade = formData.get("grade") as string;

  // Convert comma-separated strings back to arrays
  const interest_areas =
    formData.get("interest_areas")?.toString().split(",").filter(Boolean) || [];
  const strong_subjects =
    formData.get("strong_subjects")?.toString().split(",").filter(Boolean) ||
    [];
  const career_interests =
    formData.get("career_interests")?.toString().split(",").filter(Boolean) ||
    [];
  const learning_style = formData.get("learning_style") as string;
  const pathway_cluster = formData.get("pathway_cluster") as string;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // --- AI GUIDANCE LOGIC ---
    // For now, we'll generate a structured recommendation.
    // You can replace this with an actual AI API call later.
    const aiGuidance = `Based on ${studentName}'s interest in ${interest_areas.slice(0, 2).join(" & ")} and strength in ${strong_subjects.slice(0, 1)}, the ${pathway_cluster} cluster is an excellent fit. Suggest focusing on projects involving ${career_interests[0]} to align with a ${learning_style} learning style.`;

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

    if (error) throw error;

    revalidatePath(`/parent/portal/${studentId}`);

    return {
      success: true,
      guidance: aiGuidance,
    };
  } catch (error: any) {
    console.error("saveJssPathwayAction Error:", error);
    return {
      success: false,
      message: error.message || "Failed to save pathway guidance.",
    };
  }
}

export async function markNotificationsReadAction(studentId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("student_id", studentId)
      .eq("is_read", false);

    if (error) throw error;

    revalidatePath(`/parent/portal/${studentId}`);
    return { success: true };
  } catch (error: any) {
    console.error("markNotificationsReadAction Error:", error);
    return {
      success: false,
      message: error.message || "Failed to update notifications.",
    };
  }
}
