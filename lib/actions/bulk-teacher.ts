"use server";

// lib/actions/bulk-teacher.ts
// Bulk teacher addition — processes multiple rows from CSV or multi-row form.

import { getSession } from "@/lib/actions/auth";
import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";

const rowSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().min(9).max(15),
  tscNumber: z.string().max(30).optional().default(""),
});

export type BulkTeacherRow = z.infer<typeof rowSchema>;

export interface BulkTeacherResult {
  index: number;
  fullName: string;
  success: boolean;
  message: string;
}

export async function bulkAddTeachersAction(rows: BulkTeacherRow[]): Promise<{
  results: BulkTeacherResult[];
  successCount: number;
  failCount: number;
}> {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    return {
      results: rows.map((r, i) => ({
        index: i,
        fullName: r.fullName,
        success: false,
        message: "Unauthorized",
      })),
      successCount: 0,
      failCount: rows.length,
    };
  }

  const results: BulkTeacherResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const parsed = rowSchema.safeParse(row);

    if (!parsed.success) {
      results.push({
        index: i,
        fullName: row.fullName,
        success: false,
        message: parsed.error.issues.map((e) => e.message).join("; "),
      });
      continue;
    }

    const { fullName, email, phone, tscNumber } = parsed.data;

    try {
      // 1. Create auth user
      const { data: authData, error: authErr } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          phone,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: "teacher" },
        });
      if (authErr) throw new Error(`Auth: ${authErr.message}`);
      const userId = authData.user.id;

      // 2. Insert teachers record
      const { error: tErr } = await supabaseAdmin.from("teachers").insert({
        id: userId,
        full_name: fullName,
        email,
        phone_number: phone,
        tsc_number: tscNumber || null,
        last_invite_sent: new Date().toISOString(),
      });
      if (tErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Teacher record: ${tErr.message}`);
      }

      // 3. Link profile
      await supabaseAdmin
        .from("profiles")
        .update({ teacher_id: userId })
        .eq("id", userId);

      // 4. Generate setup link + send email
      const { data: linkData, error: linkErr } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
          },
        });
      if (linkErr) throw linkErr;

      await sendTeacherWelcomeEmail({
        teacherEmail: email,
        teacherName: fullName,
        setupLink: linkData.properties.action_link,
      });

      results.push({
        index: i,
        fullName,
        success: true,
        message: "Added successfully",
      });
    } catch (err: any) {
      results.push({
        index: i,
        fullName: row.fullName,
        success: false,
        message: err.message,
      });
    }
  }

  revalidatePath("/admin/teachers");
  revalidatePath("/admin");

  const successCount = results.filter((r) => r.success).length;
  return { results, successCount, failCount: rows.length - successCount };
}
