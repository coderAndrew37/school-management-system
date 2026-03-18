"use server";

import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../supabase/admin";
import { getAuthConfirmUrl } from "@/lib/utils/site-url";

export async function addTeacherAction(formData: FormData) {
  const fullName = formData.get("fullName") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const tscNumber = formData.get("tscNumber") as string;

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

    // 2. Insert into Teachers table
    const { error: teacherError } = await supabaseAdmin
      .from("teachers")
      .insert({
        id: userId,
        full_name: fullName,
        email,
        phone_number: phone,
        tsc_number: tscNumber,
        last_invite_sent: new Date().toISOString(),
      });

    if (teacherError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw teacherError;
    }

    // 3. Link the Profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ teacher_id: userId })
      .eq("id", userId);

    if (profileError) throw profileError;

    // 4. Generate setup link — uses getAuthConfirmUrl() so it's always
    //    the production domain, never localhost
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkError) throw linkError;

    // 5. Send branded welcome email via Resend
    await sendTeacherWelcomeEmail({
      teacherEmail: email,
      teacherName: fullName,
      setupLink: linkData.properties.action_link,
    });

    revalidatePath("/teachers");
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    console.error("addTeacherAction failed:", error.message);
    return { success: false, message: error.message };
  }
}
