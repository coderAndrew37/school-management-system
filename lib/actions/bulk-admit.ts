"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/actions/auth";
import { sendWelcomeEmail } from "@/lib/mail";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";
import { normalizeKenyanPhone, KENYAN_PHONE_REGEX } from "../utils/phone";
import { getAuthConfirmUrl } from "../utils/site-url";

// ── Validation Schema ──────────────────────────────────────────────────────

const bulkAdmitRowSchema = z.object({
  studentName: z.string().min(2, "Student name too short").max(100),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["Male", "Female"]),
  currentGrade: z.string().min(1, "Grade required").max(30),
  stream: z.string().min(1, "Stream required").default("Main"),
  academicYear: z.number().default(2026),
  relationshipType: z.enum(["mother", "father", "guardian", "other"]).default("guardian"),

  // Parent mode: "existing" uses existingParentId; "new" uses the fields below
  parentMode: z.enum(["new", "existing"]).default("new"),
  existingParentId: z.string().nullable().optional(),

  // New parent fields — required only when parentMode === "new"
  parentName: z.string().min(2, "Parent name too short").max(100).optional(),
  parentEmail: z.string().email("Invalid email").optional(),
  parentPhone: z.string().min(9, "Phone too short").max(15).optional(),
}).superRefine((data, ctx) => {
  if (data.parentMode === "new") {
    if (!data.parentName || data.parentName.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentName"], message: "Parent name is required" });
    }
    if (!data.parentEmail) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentEmail"], message: "Parent email is required" });
    }
    if (!data.parentPhone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentPhone"], message: "Parent phone is required" });
    }
  } else {
    if (!data.existingParentId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["existingParentId"], message: "Please select an existing parent" });
    }
  }
});

export type BulkAdmitRow = z.infer<typeof bulkAdmitRowSchema>;

export interface BulkAdmitResult {
  index: number;
  studentName: string;
  success: boolean;
  message: string;
  studentId?: string;
  isExistingParent?: boolean;
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
        message: "Unauthorized",
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
      // 1. Find Class
      const { data: classRecord, error: classErr } = await supabaseAdmin
        .from("classes")
        .select("id, grade")
        .eq("grade", row.currentGrade)
        .eq("stream", row.stream)
        .eq("academic_year", row.academicYear)
        .maybeSingle();

      if (classErr) throw new Error(`Class lookup failed: ${classErr.message}`);
      if (!classRecord) throw new Error(`Class not found: ${row.currentGrade} – ${row.stream}`);

      // 2. Resolve Parent
      let parentId: string;
      let isExistingParent = false;
      let isNewParent = false;

      if (row.parentMode === "existing" && row.existingParentId) {
        // Verify the parent exists
        const { data: existingParent } = await supabaseAdmin
          .from("parents")
          .select("id")
          .eq("id", row.existingParentId)
          .maybeSingle();

        if (!existingParent) throw new Error("Selected parent no longer exists");
        parentId = existingParent.id;
        isExistingParent = true;
      } else {
        // New parent flow — check for duplicates first
        const email = row.parentEmail!.toLowerCase().trim();
        const phone = normalizeKenyanPhone(row.parentPhone!);

        if (!KENYAN_PHONE_REGEX.test(phone.replace(/\s/g, ""))) {
          throw new Error("Invalid Kenyan phone number format");
        }

        const { data: existingByContact } = await supabaseAdmin
          .from("parents")
          .select("id, full_name")
          .or(`email.eq.${email},phone_number.eq.${phone}`)
          .maybeSingle();

        if (existingByContact) {
          // Auto-link instead of failing — parent already exists, just link student
          parentId = existingByContact.id;
          isExistingParent = true;
        } else {
          // Create auth user
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
            full_name: row.parentName!,
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

      // 4. Link Student → Parent (check for duplicate link first)
      const { data: existingLink } = await supabaseAdmin
        .from("student_parents")
        .select("student_id")
        .eq("student_id", student.id)
        .eq("parent_id", parentId)
        .maybeSingle();

      if (!existingLink) {
        const { error: linkErr } = await supabaseAdmin.from("student_parents").insert({
          student_id: student.id,
          parent_id: parentId,
          relationship_type: row.relationshipType,
          is_primary_contact: true,
        });

        if (linkErr) {
          await supabaseAdmin.from("students").delete().eq("id", student.id);
          throw new Error(`Failed to link parent: ${linkErr.message}`);
        }
      }

      // 5. Send Welcome Email (new parents only)
      if (isNewParent) {
        const email = row.parentEmail!.toLowerCase().trim();
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: getAuthConfirmUrl() },
        });

        if (linkData?.properties?.action_link) {
          try {
            await sendWelcomeEmail({
              parentEmail: email,
              parentName: row.parentName!,
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
        message: isExistingParent
          ? "Student admitted and linked to existing parent"
          : "Student admitted and parent invite sent",
        studentId: student.id,
        isExistingParent,
      });
      successCount++;
    } catch (err) {
      results.push({
        index: i,
        studentName: rawRow.studentName || `Row ${i + 1}`,
        success: false,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/dashboard");

  return { results, successCount, failCount: rows.length - successCount };
}