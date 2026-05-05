"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/actions/auth";
import { sendWelcomeEmail } from "@/lib/mail";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";
import { normalizeKenyanPhone, KENYAN_PHONE_REGEX } from "../utils/phone";

// ── Validation Schema ──────────────────────────────────────────────────────

const bulkAdmitRowSchema = z.object({
  studentName: z.string().min(2, "Student name is too short").max(100),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["Male", "Female"]),
  currentGrade: z.string().min(1, "Grade is required").max(30),
  stream: z.string().min(1, "Stream is required").default("Main"),
  academicYear: z.number().default(2026),           // Made optional with default
  parentName: z.string().min(2, "Parent name is too short").max(100),
  parentEmail: z.string().email("Invalid parent email"),
  parentPhone: z.string().min(9, "Phone number is too short").max(15),
});

export type BulkAdmitRow = z.infer<typeof bulkAdmitRowSchema>;

export interface BulkAdmitResult {
  index: number;
  studentName: string;
  success: boolean;
  message: string;
  studentId?: string;
}

// ── Bulk Admit Students Action ─────────────────────────────────────────────

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
        studentName: r.studentName || `Row ${i + 1}`,
        success: false,
        message: "Unauthorized access",
      })),
      successCount: 0,
      failCount: rows.length,
    };
  }

  const results: BulkAdmitResult[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];

    const parsed = bulkAdmitRowSchema.safeParse(rawRow);
    if (!parsed.success) {
      results.push({
        index: i,
        studentName: rawRow.studentName || `Row ${i + 1}`,
        success: false,
        message: parsed.error.issues.map((e) => e.message).join("; "),
      });
      continue;
    }

    const row = parsed.data;

    try {
      const email = row.parentEmail.toLowerCase().trim();
      const phone = normalizeKenyanPhone(row.parentPhone);

      if (!KENYAN_PHONE_REGEX.test(phone.replace(/\s/g, ""))) {
        throw new Error("Invalid Kenyan phone number format");
      }

      // 1. Find Class
      const { data: classRecord, error: classErr } = await supabaseAdmin
        .from("classes")
        .select("id, grade")
        .eq("grade", row.currentGrade)
        .eq("stream", row.stream)
        .eq("academic_year", row.academicYear)
        .maybeSingle();

      if (classErr) throw new Error(`Class lookup failed: ${classErr.message}`);
      if (!classRecord) throw new Error(`Class not found: ${row.currentGrade} - ${row.stream}`);

      // 2. Parent Handling
      let parentId: string;
      let isNewParent = false;

      const { data: existingParent } = await supabaseAdmin
        .from("parents")
        .select("id")
        .or(`email.eq.${email},phone_number.eq.${phone}`)
        .maybeSingle();

      if (existingParent) {
        parentId = existingParent.id;
      } else {
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          phone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: { full_name: row.parentName, role: "parent" },
        });

        if (authErr) throw new Error(`Auth creation failed: ${authErr.message}`);

        parentId = authUser.user.id;
        isNewParent = true;

        const { error: parentErr } = await supabaseAdmin.from("parents").insert({
          id: parentId,
          full_name: row.parentName,
          email,
          phone_number: phone,
          invite_accepted: false,
          last_invite_sent: new Date().toISOString(),
        });

        if (parentErr) {
          await supabaseAdmin.auth.admin.deleteUser(parentId).catch(() => {});
          throw new Error(`Parent record failed: ${parentErr.message}`);
        }
      }

      // 3. Create Student
      const { data: student, error: studentErr } = await supabaseAdmin
        .from("students")
        .insert({
          full_name: row.studentName,
          date_of_birth: row.dateOfBirth,
          gender: row.gender,
          current_grade: row.currentGrade,
          class_id: classRecord.id,
          status: "active",
        })
        .select("id")
        .single();

      if (studentErr || !student) throw new Error(`Student creation failed: ${studentErr?.message}`);

      // 4. Link Student to Parent
      const { error: linkErr } = await supabaseAdmin.from("student_parents").insert({
        student_id: student.id,
        parent_id: parentId,
        relationship_type: "guardian",
        is_primary_contact: true,
      });

      if (linkErr) {
        await supabaseAdmin.from("students").delete().eq("id", student.id);
        throw new Error(`Failed to link parent: ${linkErr.message}`);
      }

      // 5. Send Welcome Email (for new parents)
      if (isNewParent) {
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm` },
        });

        if (linkData?.properties?.action_link) {
          try {
            await sendWelcomeEmail({
              parentEmail: email,
              parentName: row.parentName,
              studentName: row.studentName,
              grade: `${row.currentGrade} (${row.stream})`,
              setupLink: linkData.properties.action_link,
            });
          } catch (emailErr) {
            console.error("Welcome email failed:", emailErr);
          }
        }
      }

      results.push({
        index: i,
        studentName: row.studentName,
        success: true,
        message: "Student admitted successfully",
        studentId: student.id,
      });
      successCount++;

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error occurred";

      results.push({
        index: i,
        studentName: row.studentName || `Row ${i + 1}`,
        success: false,
        message,
      });
    }
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/dashboard");

  return {
    results,
    successCount,
    failCount: rows.length - successCount,
  };
}