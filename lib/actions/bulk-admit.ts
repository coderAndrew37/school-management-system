"use server";

// lib/actions/bulk-admit.ts
// Bulk student admission — processes multiple rows from CSV or multi-row form.
// Each row: studentName, dateOfBirth, gender, currentGrade, parentName, parentEmail, parentPhone

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/actions/auth";
import { sendWelcomeEmail } from "@/lib/mail";
import { z } from "zod";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const rowSchema = z.object({
  studentName: z.string().min(2).max(100),
  dateOfBirth: z.string().min(1),
  gender: z.enum(["Male", "Female"]),
  currentGrade: z.string().min(1).max(30),
  parentName: z.string().min(2).max(100),
  parentEmail: z.string().email(),
  parentPhone: z.string().min(9).max(15),
});

export type BulkAdmitRow = z.infer<typeof rowSchema>;

export interface BulkAdmitResult {
  index: number;
  studentName: string;
  success: boolean;
  message: string;
}

export async function bulkAdmitStudentsAction(rows: BulkAdmitRow[]): Promise<{
  results: BulkAdmitResult[];
  successCount: number;
  failCount: number;
}> {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    return {
      results: rows.map((r, i) => ({
        index: i,
        studentName: r.studentName,
        success: false,
        message: "Unauthorized",
      })),
      successCount: 0,
      failCount: rows.length,
    };
  }

  const results: BulkAdmitResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const parsed = rowSchema.safeParse(row);

    if (!parsed.success) {
      results.push({
        index: i,
        studentName: row.studentName,
        success: false,
        message: parsed.error.errors.map((e) => e.message).join("; "),
      });
      continue;
    }

    const {
      studentName,
      dateOfBirth,
      gender,
      currentGrade,
      parentName,
      parentEmail,
      parentPhone,
    } = parsed.data;

    try {
      // ── 1. Upsert parent auth user ─────────────────────────────────────────
      // Check if parent email already exists in parents table
      const { data: existingParent } = await supabaseAdmin
        .from("parents")
        .select("id")
        .eq("email", parentEmail)
        .maybeSingle();

      let parentId: string;
      let isNewParent = false;

      if (existingParent) {
        parentId = existingParent.id;
      } else {
        // Create auth user for parent
        const { data: authData, error: authErr } =
          await supabaseAdmin.auth.admin.createUser({
            email: parentEmail,
            email_confirm: true,
            user_metadata: { full_name: parentName, role: "parent" },
          });
        if (authErr) throw new Error(`Auth: ${authErr.message}`);

        parentId = authData.user.id;
        isNewParent = true;

        // Insert parent record
        const { error: pErr } = await supabaseAdmin.from("parents").insert({
          id: parentId,
          full_name: parentName,
          email: parentEmail,
          phone_number: parentPhone,
          last_invite_sent: new Date().toISOString(),
        });
        if (pErr) {
          await supabaseAdmin.auth.admin.deleteUser(parentId);
          throw new Error(`Parent record: ${pErr.message}`);
        }

        // Update profile role
        await supabaseAdmin
          .from("profiles")
          .update({ role: "parent" })
          .eq("id", parentId);
      }

      // ── 2. Insert student ──────────────────────────────────────────────────
      const { data: student, error: sErr } = await supabaseAdmin
        .from("students")
        .insert({
          full_name: studentName,
          date_of_birth: dateOfBirth,
          gender,
          current_grade: currentGrade,
        })
        .select("id")
        .single();
      if (sErr || !student) throw new Error(`Student: ${sErr?.message}`);

      // ── 3. Link student ↔ parent ───────────────────────────────────────────
      const { error: linkErr } = await supabaseAdmin
        .from("student_parents")
        .insert({
          student_id: student.id,
          parent_id: parentId,
          relationship_type: "guardian",
          is_primary_contact: true,
        });
      if (linkErr) {
        await supabaseAdmin.from("students").delete().eq("id", student.id);
        throw new Error(`Link: ${linkErr.message}`);
      }

      // ── 4. Send invite email if new parent ────────────────────────────────
      if (isNewParent) {
        try {
          const { data: linkData } =
            await supabaseAdmin.auth.admin.generateLink({
              type: "recovery",
              email: parentEmail,
              options: {
                redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
              },
            });
          if (linkData) {
            await sendWelcomeEmail({
              parentEmail,
              parentName,
              studentName,
              grade: currentGrade,
              setupLink: linkData.properties.action_link,
            });
          }
        } catch (mailErr) {
          console.error("[bulkAdmit mail]", mailErr);
          // Non-fatal
        }
      }

      results.push({
        index: i,
        studentName,
        success: true,
        message: "Admitted successfully",
      });
    } catch (err: any) {
      results.push({
        index: i,
        studentName: row.studentName,
        success: false,
        message: err.message,
      });
    }
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin");

  const successCount = results.filter((r) => r.success).length;
  return { results, successCount, failCount: rows.length - successCount };
}
