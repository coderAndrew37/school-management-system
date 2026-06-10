// lib/actions/settings.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyUserPermission } from "./permissions";
import { z } from "zod";

// ── Types & Action Interfaces ───────────────────────────────────────────────────

export interface SchoolSettings {
  id: string;
  school_id: string;
  school_name: string;
  school_motto: string | null;
  school_address: string | null;
  school_phone: string | null;
  school_email: string | null;
  logo_url: string | null;
  current_term: 1 | 2 | 3;
  current_academic_year: number;
  term1_start: string | null;
  term1_end: string | null;
  term2_start: string | null;
  term2_end: string | null;
  term3_start: string | null;
  term3_end: string | null;
  sms_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface SettingsActionResult {
  success: boolean;
  message: string;
}

// ── Normalization Helper ──────────────────────────────────────────────────────
//
// Converts any empty string to null. This is the single chokepoint that
// prevents "" from reaching PostgreSQL date columns, which reject it with:
//   "invalid input syntax for type date: """
//
// Call this on every value sourced from FormData or DB fallbacks before
// passing into the Zod schema.

function nullifyEmpty(value: FormDataEntryValue | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

// ── Strict Validation Schema ──────────────────────────────────────────────────
//
// The date fields accept either a valid date string or null.
// Empty strings never reach here because nullifyEmpty() is applied upstream,
// but the .nullable() guards are kept as a safety net.

const schoolSettingsSchema = z.object({
  school_name: z.string().min(1, "School name is required").max(120),
  school_motto: z.string().max(200).nullable(),
  school_address: z.string().max(300).nullable(),
  school_phone: z.string().max(30).nullable(),
  school_email: z.string().email("Invalid institutional email structure").nullable(),

  current_term: z.coerce.number().int().min(1).max(3),
  current_academic_year: z.coerce.number().int().min(2020).max(2040),

  // Date fields: null is valid (column is nullable); "" is not (Postgres rejects it).
  // nullifyEmpty() ensures these are always null | "YYYY-MM-DD" by the time we get here.
  term1_start: z.string().nullable(),
  term1_end: z.string().nullable(),
  term2_start: z.string().nullable(),
  term2_end: z.string().nullable(),
  term3_start: z.string().nullable(),
  term3_end: z.string().nullable(),

  sms_notifications_enabled: z.boolean().default(true),
  email_notifications_enabled: z.boolean().default(true),
});

// ── Read ──────────────────────────────────────────────────────────────────────

export async function fetchSchoolSettings(): Promise<SchoolSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data: profileData } = await supabase.auth.getUser();
  if (!profileData.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", profileData.user.id)
    .single();

  if (!profile?.school_id) return null;

  const { data, error } = await supabase
    .from("school_settings")
    .select("*")
    .eq("school_id", profile.school_id)
    .maybeSingle();

  if (error) {
    console.error("[fetchSchoolSettings] operational read failure:", error.message);
    return null;
  }

  if (!data) {
    const defaults = {
      school_id: profile.school_id,
      school_name: "Kibali Academy",
      current_term: 1,
      current_academic_year: 2026,
    };

    const { data: fallbackRow } = await supabaseAdmin
      .from("school_settings")
      .insert(defaults)
      .select()
      .single();

    return fallbackRow;
  }

  return data;
}

// ── Update Action ─────────────────────────────────────────────────────────────

export async function updateSchoolSettings(
  formData: FormData
): Promise<SettingsActionResult> {
  const targetFormType = formData.get("__form_type") as "identity" | "calendar" | "notifications";
  const catalogKey = `settings.${targetFormType}.write`;

  const { hasAccess, schoolId, userId } = await verifyUserPermission(catalogKey);
  if (!hasAccess) return { success: false, message: "Unauthorized resource access." };

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from("school_settings")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  // ── Term resolution ──────────────────────────────────────────────────────
  // Prefer the submitted value; fall back to the persisted row; hard-default to 1.
  const formTerm = formData.get("current_term")
    ? Number(formData.get("current_term"))
    : (current?.current_term ?? 1);

  // ── Date field resolution ────────────────────────────────────────────────
  //
  // Key invariant: a date field must be either a valid "YYYY-MM-DD" string or
  // null. It must NEVER be an empty string.
  //
  // Strategy per form type:
  //   - "calendar" form + matching term  → take submitted value (may be null if cleared)
  //   - everything else                  → preserve the existing DB value (may be null)
  //
  // nullifyEmpty() is applied to every source (FormData AND DB fallback) so
  // that stale "" values already stored in the DB also get normalized to null.

  function resolveDate(
    isActiveTermField: boolean,
    formFieldName: string,
    existingValue: string | null | undefined
  ): string | null {
    if (targetFormType === "calendar" && isActiveTermField) {
      // The calendar form is actively managing this field — use what was submitted.
      return nullifyEmpty(formData.get(formFieldName));
    }
    // Any other form type: preserve the existing row value, normalizing "" → null.
    return nullifyEmpty(existingValue);
  }

  const raw = {
    // ── Identity fields ────────────────────────────────────────────────────
    // nullifyEmpty() applied so optional text fields also collapse "" → null
    // (prevents subtle schema mismatches on motto/address/phone/email).
    school_name:
      nullifyEmpty(formData.get("school_name")) ?? current?.school_name ?? "Kibali Academy",
    school_motto:
      nullifyEmpty(formData.get("school_motto") ?? current?.school_motto),
    school_address:
      nullifyEmpty(formData.get("school_address") ?? current?.school_address),
    school_phone:
      nullifyEmpty(formData.get("school_phone") ?? current?.school_phone),
    school_email:
      nullifyEmpty(formData.get("school_email") ?? current?.school_email),

    // ── Calendar scalars ───────────────────────────────────────────────────
    current_term: formTerm,
    current_academic_year:
      formData.get("current_academic_year") ?? current?.current_academic_year ?? "2026",

    // ── Date fields ────────────────────────────────────────────────────────
    // Each field independently decides whether the submitted value or the
    // preserved DB value wins, based on which term the calendar form is editing.
    term1_start: resolveDate(formTerm === 1, "term_start_date", current?.term1_start),
    term1_end:   resolveDate(formTerm === 1, "term_end_date",   current?.term1_end),
    term2_start: resolveDate(formTerm === 2, "term_start_date", current?.term2_start),
    term2_end:   resolveDate(formTerm === 2, "term_end_date",   current?.term2_end),
    term3_start: resolveDate(formTerm === 3, "term_start_date", current?.term3_start),
    term3_end:   resolveDate(formTerm === 3, "term_end_date",   current?.term3_end),

    // ── Notification flags ─────────────────────────────────────────────────
    sms_notifications_enabled: formData.has("sms_notifications_enabled")
      ? formData.get("sms_notifications_enabled") === "true"
      : current?.sms_notifications_enabled ?? true,
    email_notifications_enabled: formData.has("email_notifications_enabled")
      ? formData.get("email_notifications_enabled") === "true"
      : current?.email_notifications_enabled ?? true,
  };

  const parsed = schoolSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }

  const { error } = await supabaseAdmin
    .from("school_settings")
    .upsert(
      {
        school_id: schoolId,
        ...parsed.data,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "school_id" }
    );

  if (error) {
    console.error("[updateSchoolSettings] database write crash:", error.message);
    return { success: false, message: "Failed to persist operational details." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true, message: "Global configurations synchronized successfully." };
}

// ── Logo Upload Action ────────────────────────────────────────────────────────

export async function uploadSchoolLogo(
  formData: FormData
): Promise<SettingsActionResult> {
  const { hasAccess, schoolId } = await verifyUserPermission("settings.identity.write");
  if (!hasAccess) return { success: false, message: "Unauthorized asset access." };

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    return { success: false, message: "No valid image file detected in form payload." };
  }

  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, message: "Asset file payload exceeds structural limit of 2MB." };
  }

  const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { success: false, message: "Invalid asset format. Only PNG, JPEG, WEBP, or SVG are permitted." };
  }

  const supabase = await createSupabaseServerClient();

  const fileExtension = file.name.split(".").pop() ?? "png";
  const isolatedFilePath = `${schoolId}/logo-${Date.now()}.${fileExtension}`;

  const { error: storageError } = await supabase.storage
    .from("school-logos")
    .upload(isolatedFilePath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (storageError) {
    console.error("[uploadSchoolLogo] Supabase storage upload failure:", storageError.message);
    return { success: false, message: "Failed to persist media asset to remote cloud pipeline." };
  }

  const { data: linkResolution } = supabase.storage
    .from("school-logos")
    .getPublicUrl(isolatedFilePath);

  if (!linkResolution?.publicUrl) {
    return { success: false, message: "Failed to compute resource link layout references safely." };
  }

  const { error: dbError } = await supabaseAdmin
    .from("school_settings")
    .update({
      logo_url: linkResolution.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("school_id", schoolId);

  if (dbError) {
    console.error("[uploadSchoolLogo] Database field link updates collapsed:", dbError.message);
    return { success: false, message: "Asset uploaded, but synchronization to school profiles failed." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true, message: "Institutional branding logo updated successfully." };
}