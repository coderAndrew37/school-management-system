"use server";

import { getSession } from "@/lib/actions/auth";
import { sendTeacherWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";
import { normalizeKenyanPhone, KENYAN_PHONE_REGEX } from "../utils/phone";
import { getAuthConfirmUrl } from "../utils/site-url";

// ── TSC placeholder values that should be stored as NULL ─────────────────────
// Admins often type these when a teacher has no TSC number yet.
// PostgreSQL allows multiple NULLs in a unique index, so this is safe.
const TSC_PLACEHOLDERS = new Set([
  "n/a", "na", "none", "nil", "null", "0", "pending",
  "bom", "board of management", "-", "--", "tba", "tbd", "unknown",
]);

function normalizeTsc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (TSC_PLACEHOLDERS.has(trimmed.toLowerCase())) return null;
  return trimmed.toUpperCase();
}

// ── Validation Schema ─────────────────────────────────────────────────────────

const rowSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name too short")
    .max(100)
    .transform((v) => v.trim()),
  email: z
    .string()
    .email("Invalid email address")
    .transform((v) => v.toLowerCase().trim()),
  phone: z
    .string()
    .min(9, "Phone number too short")
    .max(15)
    .transform((v) => v.trim()),
  tscNumber: z
    .string()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => normalizeTsc(v)),
});

export type BulkStaffRow = z.infer<typeof rowSchema>;

export interface BulkStaffResult {
  index:    number;
  fullName: string;
  success:  boolean;
  message:  string;
}

// ── Bulk Add Staff Action ─────────────────────────────────────────────────────

export async function bulkAddStaffAction(rows: BulkStaffRow[]): Promise<{
  results:      BulkStaffResult[];
  successCount: number;
  failCount:    number;
}> {
  const session = await getSession();

  if (!session?.profile) throw new Error("Unauthorized");

  // Updated to use base_role as the principal access controller
  const { base_role, is_super_admin, is_dev, school_id } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  if (base_role !== "admin" && !isPlatformAdmin) throw new Error("Unauthorized");
  if (!school_id) throw new Error("Admin profile has no school assigned");

  const results: BulkStaffResult[] = [];

  for (const [i, rawRow] of rows.entries()) {
    try {
      // ── Row validation ───────────────────────────────────────────────────
      const parsed = rowSchema.safeParse(rawRow);
      if (!parsed.success) {
        results.push({
          index:    i,
          fullName: rawRow.fullName || `Row ${i + 1}`,
          success:  false,
          message:  parsed.error.issues.map((e) => e.message).join("; "),
        });
        continue;
      }

      const data           = parsed.data;
      const normalizedPhone = normalizeKenyanPhone(data.phone);

      if (!KENYAN_PHONE_REGEX.test(normalizedPhone.replace(/\s/g, ""))) {
        throw new Error(`Invalid Kenyan phone number format: ${data.phone}`);
      }

      // ── Scenario B & C: TSC number already in the system ────────────────
      if (data.tscNumber) {
        const { data: existingTeacher } = await supabaseAdmin
          .from("teachers")
          .select("id, school_id, status")
          .eq("tsc_number", data.tscNumber)
          .maybeSingle();

        if (existingTeacher) {
          // Scenario C — intra-school duplicate: already at this school
          if (existingTeacher.school_id === school_id) {
            results.push({
              index:    i,
              fullName: data.fullName,
              success:  true,
              message:  "Teacher already registered at your school",
            });
            continue;
          }

          // Scenario B — inter-school transfer: move them to this school
          const { error: transferTeacherErr } = await supabaseAdmin
            .from("teachers")
            .update({ school_id, status: "active" })
            .eq("id", existingTeacher.id);

          if (transferTeacherErr) {
            throw new Error(`Transfer failed (teachers): ${transferTeacherErr.message}`);
          }

          const { error: transferProfileErr } = await supabaseAdmin
            .from("profiles")
            .update({ school_id })
            .eq("id", existingTeacher.id);

          if (transferProfileErr) {
            throw new Error(`Transfer failed (profiles): ${transferProfileErr.message}`);
          }

          results.push({
            index:    i,
            fullName: data.fullName,
            success:  true,
            message:  "Teacher transferred to your school",
          });
          continue;
        }
      }

      // ── Scenario D: contact collision check ──────────────────────────────
      const { data: contactConflict } = await supabaseAdmin
        .from("profiles")
        .select("id, email, phone_number")
        .or(`email.eq.${data.email},phone_number.eq.${normalizedPhone}`)
        .maybeSingle();

      if (contactConflict) {
        throw new Error(
          `Email or phone already in use by another account` +
          (contactConflict.email === data.email
            ? ` (email: ${data.email})`
            : ` (phone: ${normalizedPhone})`)
        );
      }

      // ── 1. Create auth user ──────────────────────────────────────────────
      // sync base_role to metadata pipeline requirements
      const { data: authData, error: authErr } =
        await supabaseAdmin.auth.admin.createUser({
          email:         data.email,
          phone:         normalizedPhone,
          email_confirm: true,
          user_metadata: { full_name: data.fullName, base_role: "staff" },
        });

      if (authErr) throw new Error(`Auth user creation failed: ${authErr.message}`);
      const userId = authData.user.id;

      // ── 2. Insert teachers row ───────────────────────────────────────────
      const { error: teacherErr } = await supabaseAdmin
        .from("teachers")
        .insert({
          id:         userId,
          school_id,
          tsc_number: data.tscNumber,
          status:     "active",
        });

      if (teacherErr) {
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Teacher record creation failed: ${teacherErr.message}`);
      }

      // ── 3. Upsert profiles row ───────────────────────────────────────────
      // Corrected keys: base_role mapped to 'staff', role holds compatibility fallback 'teacher'
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id:             userId,
            full_name:      data.fullName,
            email:          data.email,
            phone_number:   normalizedPhone,
            base_role:      "staff",
            role:           "teacher",  
            school_id,
            teacher_id:     userId,
            is_super_admin: false,
            is_dev:         false,
          },
          { onConflict: "id" }
        );

      if (profileErr) {
        await supabaseAdmin.from("teachers").delete().eq("id", userId);
        await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
        throw new Error(`Profile setup failed: ${profileErr.message}`);
      }

      // ── 4. Welcome email (fire-and-forget) ───────────────────────────────
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type:    "recovery",
        email:   data.email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

      if (linkData?.properties?.action_link) {
        sendTeacherWelcomeEmail({
          teacherEmail: data.email,
          teacherName:  data.fullName,
          setupLink:    linkData.properties.action_link,
        }).catch((err) =>
          console.error(`Welcome email failed for ${userId}:`, err)
        );
      }

      results.push({
        index:    i,
        fullName: data.fullName,
        success:  true,
        message:  "Teacher added successfully",
      });

    } catch (err) {
      results.push({
        index:    i,
        fullName: rawRow.fullName || `Row ${i + 1}`,
        success:  false,
        message:  err instanceof Error ? err.message : "Unknown error",
      });
    }

    if (rows.length > 3) await new Promise((r) => setTimeout(r, 100));
  }

  revalidatePath("/admin/teachers");

  const successCount = results.filter((r) => r.success).length;
  return { results, successCount, failCount: rows.length - successCount };
}