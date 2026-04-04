"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/actions/auth";
import { sendWelcomeEmail } from "@/lib/mail";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";
import { normalizeKenyanPhone } from "../utils/phone";

const rowSchema = z.object({
  studentName: z.string().min(2, "Name too short").max(100),
  dateOfBirth: z.string().min(1, "DOB required"),
  gender: z.enum(["Male", "Female"]),
  currentGrade: z.string().min(1).max(30),
  parentName: z.string().min(2, "Parent name too short").max(100),
  parentEmail: z.string().email("Invalid email"),
  parentPhone: z.string().min(9, "Phone too short").max(15),
});

export type BulkAdmitRow = z.infer<typeof rowSchema>;

export interface BulkAdmitResult {
  index: number;
  studentName: string;
  success: boolean;
  message: string;
  studentId?: string;
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
        studentName: row.studentName || `Row ${i + 1}`,
        success: false,
        message: parsed.error.issues.map((e) => e.message).join(", "),
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
      const email = parentEmail.toLowerCase();
      const phone = normalizeKenyanPhone(parentPhone);

      // ── 1. Parent Handling ─────────────────────────────────────────────────
      let parentId: string;
      let isNewParent = false;

      const { data: existingParent } = await supabaseAdmin
        .from("parents")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingParent) {
        parentId = existingParent.id;
      } else {
        const { data: authData, error: authErr } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            phone,
            email_confirm: true,
            user_metadata: { full_name: parentName, role: "parent" },
          });

        if (authErr) throw new Error(`Auth: ${authErr.message}`);
        parentId = authData.user.id;
        isNewParent = true;
      }

      // UPSERT the parent record. This fixes the "NA" phone number issue and
      // solves the "Duplicate Key" error by updating the record if the trigger
      // created it first.
      const { error: pErr } = await supabaseAdmin.from("parents").upsert({
        id: parentId,
        full_name: parentName,
        email: email,
        phone_number: phone,
      });

      if (pErr) throw new Error(`Parent Record: ${pErr.message}`);

      // ── 2. Student Creation ────────────────────────────────────────────────
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

      // ── 3. Linking ─────────────────────────────────────────────────────────
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
        throw new Error(`Linking: ${linkErr.message}`);
      }

      // ── 4. Welcome Email ───────────────────────────────────────────────────
      if (isNewParent) {
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
          },
        });

        if (linkData?.properties?.action_link) {
          await sendWelcomeEmail({
            parentEmail: email,
            parentName,
            studentName,
            grade: currentGrade,
            setupLink: linkData.properties.action_link,
          });
        }
      }

      results.push({
        index: i,
        studentName,
        success: true,
        message: "Success",
        studentId: student.id,
      });
    } catch (err: any) {
      results.push({
        index: i,
        studentName: studentName || "Unknown",
        success: false,
        message: err.message,
      });
    }
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/dashboard");

  const successCount = results.filter((r) => r.success).length;
  return { results, successCount, failCount: rows.length - successCount };
}
