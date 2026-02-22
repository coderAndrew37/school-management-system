"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { sendTeacherWelcomeEmail } from "@/lib/mail"; // Import the new function

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
        email: email,
        phone_number: phone,
        tsc_number: tscNumber,
        last_invite_sent: new Date().toISOString(), // Track the invite
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

    // 4. Generate Link
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
        },
      });

    if (linkError) throw linkError;

    // 5. Send Professional Welcome Email
    const setupLink = linkData.properties.action_link;
    await sendTeacherWelcomeEmail({
      teacherEmail: email,
      teacherName: fullName,
      setupLink,
    });

    revalidatePath("/teachers");
    revalidatePath("/"); // Update dashboard stats too
    return { success: true };
  } catch (error: any) {
    console.error("Add Teacher Action Failed:", error.message);
    return { success: false, message: error.message };
  }
}
