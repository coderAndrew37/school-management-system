"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// ── Send Message ──────────────────────────────────────────────────────────────

export async function sendMessageAction(formData: FormData) {
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

    // Look up parent name via profiles (works after migration 004).
    // Profiles always exist for any authenticated user — no need to
    // join through parents table just to get a display name.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Verify the authenticated parent is actually linked to this student
    // via the student_parents join table before allowing a message.
    const { data: link, error: linkError } = await supabase
      .from("student_parents")
      .select("student_id")
      .eq("student_id", studentId)
      .eq("parent_id", user.id)
      .maybeSingle();

    if (linkError || !link) {
      throw new Error("You are not linked to this student.");
    }

    const finalThreadId = isReply && threadId ? threadId : crypto.randomUUID();

    const messageData = {
      student_id: studentId,
      sender_id: user.id,
      sender_name: profile?.full_name || "Parent",
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

// ── Mark Thread as Read ───────────────────────────────────────────────────────

export async function markThreadAsReadAction(
  threadId: string,
  studentId: string,
) {
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

// ── Save JSS Pathway ──────────────────────────────────────────────────────────

export async function saveJssPathwayAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const studentId = formData.get("student_id") as string;
  const studentName = formData.get("student_name") as string;
  const grade = formData.get("grade") as string;

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
    return { success: true, guidance: aiGuidance };
  } catch (error: any) {
    console.error("saveJssPathwayAction Error:", error);
    return {
      success: false,
      message: error.message || "Failed to save pathway guidance.",
    };
  }
}

// ── Mark Notifications Read ───────────────────────────────────────────────────

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
