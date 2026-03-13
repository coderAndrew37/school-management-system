// lib/actions/settings.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/actions/auth";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchoolSettings {
  id: string;
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

// ── Read ──────────────────────────────────────────────────────────────────────

export async function fetchSchoolSettings(): Promise<SchoolSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("school_settings")
    .select("*")
    .single();

  if (error) {
    console.error("fetchSchoolSettings error:", error.message);
    return null;
  }
  return data as SchoolSettings;
}

// ── Validation schema ─────────────────────────────────────────────────────────

const settingsSchema = z.object({
  school_name: z.string().min(1, "School name is required").max(120),
  school_motto: z.string().max(200).optional().nullable(),
  school_address: z.string().max(300).optional().nullable(),
  school_phone: z.string().max(30).optional().nullable(),
  school_email: z
    .string()
    .email("Invalid email")
    .optional()
    .nullable()
    .or(z.literal("")),
  current_term: z.coerce.number().int().min(1).max(3),
  current_academic_year: z.coerce.number().int().min(2020).max(2040),
  term1_start: z.string().optional().nullable(),
  term1_end: z.string().optional().nullable(),
  term2_start: z.string().optional().nullable(),
  term2_end: z.string().optional().nullable(),
  term3_start: z.string().optional().nullable(),
  term3_end: z.string().optional().nullable(),
  sms_notifications_enabled: z.boolean().default(true),
  email_notifications_enabled: z.boolean().default(true),
});

// ── Update general settings ───────────────────────────────────────────────────

export async function updateSchoolSettings(
  formData: FormData,
): Promise<SettingsActionResult> {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    return { success: false, message: "Unauthorised" };
  }

  const raw = {
    school_name: formData.get("school_name"),
    school_motto: formData.get("school_motto") || null,
    school_address: formData.get("school_address") || null,
    school_phone: formData.get("school_phone") || null,
    school_email: formData.get("school_email") || null,
    current_term: formData.get("current_term"),
    current_academic_year: formData.get("current_academic_year"),
    term1_start: formData.get("term1_start") || null,
    term1_end: formData.get("term1_end") || null,
    term2_start: formData.get("term2_start") || null,
    term2_end: formData.get("term2_end") || null,
    term3_start: formData.get("term3_start") || null,
    term3_end: formData.get("term3_end") || null,
    sms_notifications_enabled:
      formData.get("sms_notifications_enabled") === "true",
    email_notifications_enabled:
      formData.get("email_notifications_enabled") === "true",
  };

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, message: first?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("school_settings")
    .update({
      ...parsed.data,
      updated_by: session.profile.id,
    })
    .eq("id", (await fetchSchoolSettings())?.id ?? "");

  if (error) {
    console.error("updateSchoolSettings error:", error.message);
    return {
      success: false,
      message: "Failed to save settings. Please try again.",
    };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true, message: "Settings saved successfully." };
}

// ── Upload logo ───────────────────────────────────────────────────────────────
// Uploads to school-assets bucket, stores the path in school_settings.logo_url

export async function uploadSchoolLogo(
  formData: FormData,
): Promise<SettingsActionResult & { logo_url?: string }> {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    return { success: false, message: "Unauthorised" };
  }

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    return { success: false, message: "No file provided" };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { success: false, message: "Logo must be under 2 MB" };
  }

  if (
    !["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(
      file.type,
    )
  ) {
    return { success: false, message: "Logo must be PNG, JPEG, WEBP, or SVG" };
  }

  const ext = file.name.split(".").pop() ?? "png";
  const path = `logos/school-logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("school-assets")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true, // replace existing logo
    });

  if (uploadError) {
    console.error("Logo upload error:", uploadError.message);
    return {
      success: false,
      message: "Logo upload failed. Check storage bucket exists.",
    };
  }

  // Persist the path in settings
  const current = await fetchSchoolSettings();
  if (!current) return { success: false, message: "Settings row not found" };

  const supabase = await createSupabaseServerClient();
  const { error: updateError } = await supabase
    .from("school_settings")
    .update({ logo_url: path, updated_by: session.profile.id })
    .eq("id", current.id);

  if (updateError) {
    return {
      success: false,
      message: "Logo uploaded but settings update failed.",
    };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return {
    success: true,
    message: "Logo updated successfully.",
    logo_url: path,
  };
}
