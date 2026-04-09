"use server";

import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../supabase/admin";
import { getAuthConfirmUrl } from "@/lib/utils/site-url";
import { normalizeKenyanPhone } from "@/lib/utils/phone";
import type { ActionResult } from "@/lib/types/dashboard";

export async function addTeacherAction(formData: FormData): Promise<ActionResult> {
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const rawPhone = formData.get("phone") as string;
  const tscNumber = formData.get("tscNumber") as string;
  const imageFile = formData.get("image") as File | null;

  // Apply normalization utility
  const phone = normalizeKenyanPhone(rawPhone);

  try {
    // 1. Create Auth User
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        phone,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "teacher" },
      });

    if (authError) throw authError;
    const userId = authData.user.id;

    // 2. Handle Image Upload (Optional)
    let avatarUrl: string | null = null;
    if (imageFile && imageFile.size > 0) {
      const fileExt = imageFile.name.split(".").pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `teachers/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from("avatars")
        .upload(filePath, imageFile);

      if (!uploadError) {
        const { data: publicData } = supabaseAdmin.storage
          .from("avatars")
          .getPublicUrl(filePath);
        avatarUrl = publicData.publicUrl;
      } else {
        console.error("[Storage Upload]:", uploadError.message);
      }
    }

    // 3. Insert into Teachers table
    const { error: teacherError } = await supabaseAdmin
      .from("teachers")
      .insert({
        id: userId,
        full_name: fullName,
        email,
        phone_number: phone,
        tsc_number: tscNumber,
        avatar_url: avatarUrl,
        last_invite_sent: new Date().toISOString(),
      });

    if (teacherError) {
      // Cleanup auth if DB insert fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw teacherError;
    }

    // 4. Update the Profile
    // We expect the trigger to have created the profile; we update it with teacher context
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        teacher_id: userId,
        avatar_url: avatarUrl,
      })
      .eq("id", userId);

    if (profileError) throw profileError;

    // 5. Generate setup link
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkError) throw linkError;

    // 6. Send branded welcome email
    await sendTeacherWelcomeEmail({
      teacherEmail: email,
      teacherName: fullName,
      setupLink: linkData.properties.action_link,
    });

    revalidatePath("/admin/teachers");
    revalidatePath("/admin/dashboard");

    return { 
      success: true, 
      message: "Teacher added and welcome email sent successfully." 
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    console.error("[addTeacherAction] failed:", errorMessage);
    
    return { 
      success: false, 
      message: errorMessage 
    };
  }
}