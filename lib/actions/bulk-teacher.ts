"use server";

import { getSession } from "@/lib/actions/auth";
import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";

// ── 1. Validation Schema ──────────────────────────────────────────────────────

const rowSchema = z.object({
  fullName: z.string().min(2, "Name too short").max(100),
  email: z.string().email("Invalid email"),
  phone: z.string().min(9, "Phone too short").max(15),
  tscNumber: z.string().max(30).optional().transform(v => v || null),
});

export type BulkTeacherRow = z.infer<typeof rowSchema>;

export interface BulkTeacherResult {
  index: number;
  fullName: string;
  success: boolean;
  message: string;
}

// ── 2. Bulk Action ─────────────────────────────────────────────────────────────

export async function bulkAddTeachersAction(rows: BulkTeacherRow[]): Promise<{
  results: BulkTeacherResult[];
  successCount: number;
  failCount: number;
}> {
  const session = await getSession();
  
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    throw new Error("Unauthorized"); 
  }

  const results: BulkTeacherResult[] = [];

  for (const [i, row] of rows.entries()) {
    try {
      const { data, success, error } = rowSchema.safeParse(row);
      if (!success) {
        results.push({
          index: i,
          fullName: row.fullName || `Row ${i + 1}`,
          success: false,
          message: error.issues.map((e) => e.message).join(", "),
        });
        continue;
      }

      // 1. Create Auth User
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        phone: data.phone,
        email_confirm: true,
        user_metadata: { 
          full_name: data.fullName, 
          role: "teacher" 
        },
      });

      if (authErr) throw new Error(`Auth: ${authErr.message}`);
      const userId = authData.user.id;

      // 2. Insert Teacher record
      const { error: tErr } = await supabaseAdmin.from("teachers").insert({
        id: userId,
        full_name: data.fullName,
        email: data.email,
        phone_number: data.phone,
        tsc_number: data.tscNumber,
        last_invite_sent: new Date().toISOString(),
      });

      if (tErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`DB Error: ${tErr.message}`);
      }

      // 3. Update profile (Non-blocking)
      supabaseAdmin
        .from("profiles")
        .update({ teacher_id: userId })
        .eq("id", userId)
        .then(({ error }) => {
          if (error) console.error(`Profile link failed for ${userId}:`, error.message);
        });

      // 4. Handle Email
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: data.email,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm` },
      });

      if (linkData?.properties?.action_link) {
        sendTeacherWelcomeEmail({
          teacherEmail: data.email,
          teacherName: data.fullName,
          setupLink: linkData.properties.action_link,
        }).catch(err => {
            const msg = err instanceof Error ? err.message : "Mail failed";
            console.error("Email error:", msg);
        });
      }

      results.push({
        index: i,
        fullName: data.fullName,
        success: true,
        message: "Success",
      });

    } catch (err: unknown) { // Use 'unknown' instead of 'any'
      // Use Type Narrowing to safely access the error message
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      
      results.push({
        index: i,
        fullName: row.fullName,
        success: false,
        message: errorMessage,
      });
    }

    if (rows.length > 3) await new Promise((r) => setTimeout(r, 100));
  }

  revalidatePath("/admin/teachers");
  
  const successCount = results.filter((r) => r.success).length;
  return { 
    results, 
    successCount, 
    failCount: rows.length - successCount 
  };
}