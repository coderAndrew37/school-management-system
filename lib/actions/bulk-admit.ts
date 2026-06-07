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
  studentName: z.string().min(2, "Student name too short").max(100).transform(val => val.trim()),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["Male", "Female"]),
  currentGrade: z.string().min(1, "Grade required").max(30).transform(val => val.trim()),
  stream: z.string().min(1, "Stream required").default("Main").transform(val => val.trim()),
  academicYear: z.number().default(2026),
  relationshipType: z.enum(["mother", "father", "guardian", "other"]).default("guardian"),
  upiNumber: z.string().optional().nullable().transform(val => val?.trim() || null),

  parentMode: z.enum(["new", "existing", "skip"]).default("new"),
  existingParentId: z.string().nullable().optional(),

  parentName: z.string().max(100).optional().nullable().transform(val => val?.trim() || null),
  parentEmail: z.string().optional().nullable().transform(val => val?.toLowerCase().trim() || null),
  parentPhone: z.string().optional().nullable().transform(val => val?.trim() || null),
}).superRefine((data, ctx) => {
  if (data.parentMode === "existing" && !data.existingParentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["existingParentId"],
      message: "Please select an existing parent or switch to 'New' or 'Skip'",
    });
  } else if (data.parentMode === "new") {
    const hasAny = !!(data.parentName || data.parentEmail || data.parentPhone);

    if (hasAny) {
      if (!data.parentName || data.parentName.length < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentName"], message: "Parent name required (or clear all parent fields to skip)" });
      }
      if (!data.parentEmail || !data.parentEmail.includes("@")) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentEmail"], message: "Valid parent email required (or clear all parent fields to skip)" });
      }
      if (!data.parentPhone || data.parentPhone.length < 9) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parentPhone"], message: "Parent phone required (or clear all parent fields to skip)" });
      }
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
  parentLinked?: boolean;
  parentSkipped?: boolean;
  isExistingParent?: boolean;
}

// ── Bulk Admit Students Action ─────────────────────────────────────────────

export async function bulkAdmitStudentsAction(rows: BulkAdmitRow[]): Promise<{
  results: BulkAdmitResult[];
  successCount: number;
  failCount: number;
}> {
  const session = await getSession();

  if (!session?.profile) {
    return {
      results: rows.map((r, i) => ({ index: i, studentName: r.studentName || `Row ${i + 1}`, success: false, message: "Unauthorized" })),
      successCount: 0,
      failCount: rows.length,
    };
  }

  const { base_role, is_super_admin, is_dev, school_id } = session.profile;
  if (base_role !== "admin" && !(is_super_admin || is_dev)) {
    return {
      results: rows.map((r, i) => ({ index: i, studentName: r.studentName || `Row ${i + 1}`, success: false, message: "Unauthorized" })),
      successCount: 0,
      failCount: rows.length,
    };
  }

  if (!school_id) {
    return {
      results: rows.map((r, i) => ({ index: i, studentName: r.studentName || `Row ${i + 1}`, success: false, message: "Admin profile has no school assigned" })),
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
      // ── 1. Resolve Class Safely (Tenant Specific) ───────────────────────
      const { data: classRecord, error: classErr } = await supabaseAdmin
        .from("classes")
        .select("id")
        .eq("grade", row.currentGrade)
        .eq("stream", row.stream)
        .eq("academic_year", row.academicYear)
        .eq("school_id", school_id)
        .maybeSingle();

      if (classErr) throw new Error(`Class lookup failed: ${classErr.message}`);
      if (!classRecord) throw new Error(`Class not found: ${row.currentGrade} – ${row.stream}`);

      // ── 2. Create Student (Tenant Specific) ─────────────────────────────
      const { data: student, error: studentErr } = await supabaseAdmin
        .from("students")
        .insert({
          full_name: row.studentName,
          date_of_birth: row.dateOfBirth,
          gender: row.gender,
          current_grade: row.currentGrade,
          class_id: classRecord.id,
          school_id,
          status: "active",
        })
        .select("id")
        .single();

      if (studentErr || !student) {
        throw new Error(`Student creation failed: ${studentErr?.message ?? "No data returned"}`);
      }

      // ── 3. Handle Parent Context with Resilience ─────────────────────────
      let parentLinked = false;
      let parentSkipped = false;
      let isExistingParent = false;
      let parentWarning: string | null = null;

      const wantsNewParent = row.parentMode === "new" && !!(row.parentName && row.parentEmail && row.parentPhone);
      const wantsExistingParent = row.parentMode === "existing" && !!row.existingParentId;

      try {
        if (wantsExistingParent) {
          const { data: existingParent } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("id", row.existingParentId!)
            .eq("base_role", "parent")
            .maybeSingle();

          if (!existingParent) {
            parentWarning = "Selected parent profile was missing; student created stand-alone";
            parentSkipped = true;
          } else {
            await linkParent(student.id, existingParent.id, row.relationshipType, school_id);
            parentLinked = true;
            isExistingParent = true;
          }
        } else if (wantsNewParent) {
          const email = row.parentEmail!;
          const phone = normalizeKenyanPhone(row.parentPhone!);

          if (!KENYAN_PHONE_REGEX.test(phone.replace(/\s/g, ""))) {
            parentWarning = "Invalid Kenyan phone format; parent creation skipped";
            parentSkipped = true;
          } else {
            // Option B Fix: Cross-lookup globally to handle multi-school parents safely
            const { data: duplicateContact } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .or(`email.eq.${email},phone_number.eq.${phone}`)
              .maybeSingle();

            let parentId: string;

            if (duplicateContact) {
              parentId = duplicateContact.id;
              isExistingParent = true;
            } else {
              // Complete structural creation via Auth admin pipeline
              const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
                email,
                phone,
                email_confirm: true,
                phone_confirm: true,
                user_metadata: { full_name: row.parentName, base_role: "parent" },
              });

              if (authErr) throw new Error(`Auth credential generation failed: ${authErr.message}`);
              parentId = authUser.user.id;

              // UPSERT handles race conditions smoothly if handle_new_user() runs instantly
              const { error: profileErr } = await supabaseAdmin
                .from("profiles")
                .upsert(
                  {
                    id: parentId,
                    full_name: row.parentName!,
                    email,
                    phone_number: phone,
                    base_role: "parent",
                    role: "parent", 
                    school_id, // Identifies the primary school that registered the user profile
                    is_super_admin: false,
                    is_dev: false,
                  },
                  { onConflict: "id" }
                );

              if (profileErr) {
                await supabaseAdmin.auth.admin.deleteUser(parentId).catch(() => {});
                throw new Error(`Profile initialization failed: ${profileErr.message}`);
              }

              // Fire off recovery setup links for invitation delivery pipelines
              const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
                type: "recovery",
                email,
                options: { redirectTo: getAuthConfirmUrl() },
              });

              if (linkData?.properties?.action_link) {
                sendWelcomeEmail({
                  parentEmail: email,
                  parentName: row.parentName!,
                  studentName: row.studentName,
                  grade: `${row.currentGrade} (${row.stream})`,
                  setupLink: linkData.properties.action_link,
                }).catch((err) => console.error("Welcome invitation skipped out: ", err));
              }
            }

            // Tenant boundary is established right here through the student_parents mapping
            await linkParent(student.id, parentId, row.relationshipType, school_id);
            parentLinked = true;
          }
        } else {
          parentSkipped = true;
        }
      } catch (parentErr) {
        parentWarning = `Student admitted, but parent connection failed: ${
          parentErr instanceof Error ? parentErr.message : "Internal mapping issue"
        }`;
        parentSkipped = true;
      }

      // ── 4. Format Result Responses ────────────────────────────────────────
      let message = "Admitted · no parent linked";
      if (parentLinked) {
        message = isExistingParent ? "Admitted · linked to verified parent row" : "Admitted · profile invitation sent";
      } else if (parentWarning) {
        message = parentWarning;
      }

      results.push({
        index: i,
        studentName: row.studentName,
        success: true,
        message,
        studentId: student.id,
        parentLinked,
        parentSkipped,
        isExistingParent,
      });
      successCount++;
    } catch (err) {
      results.push({
        index: i,
        studentName: rawRow.studentName || `Row ${i + 1}`,
        success: false,
        message: err instanceof Error ? err.message : "Unhandled batch disruption",
      });
    }
  }

  revalidatePath("/admin/students");
  revalidatePath("/admin/dashboard");

  return { results, successCount, failCount: rows.length - successCount };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function linkParent(
  studentId: string,
  parentId: string,
  relationshipType: string,
  schoolId: string
): Promise<void> {
  // Idempotency check prevents duplicate linkages inside the active tenant boundary
  const { data: existingLink } = await supabaseAdmin
    .from("student_parents")
    .select("student_id")
    .eq("student_id", studentId)
    .eq("parent_id", parentId)
    .maybeSingle();

  if (existingLink) return;

  const { error: linkErr } = await supabaseAdmin.from("student_parents").insert({
    student_id: studentId,
    parent_id: parentId,
    relationship_type: relationshipType,
    is_primary_contact: true,
    school_id: schoolId, // Enforces multi-tenant data safety
  });

  if (linkErr) throw new Error(`Relationship resolution block broken: ${linkErr.message}`);
}