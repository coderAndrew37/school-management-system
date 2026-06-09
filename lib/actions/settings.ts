// lib/actions/settings.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/actions/auth";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchoolSettings {
  school_id: string; // Migrated from id: number to multi-tenant school_id UUID
  school_name: string;
  school_motto: string | null;
  school_address: string | null;
  school_phone: string | null;
  school_email: string | null;
  logo_url: string | null;
  current_term: 1 | 2 | 3;
  current_academic_year: number;
  term_start_date: string | null;
  term_end_date: string | null;
  next_term_opening_date: string | null;
  sms_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface SettingsActionResult {
  success: boolean;
  message: string;
}

// ── Internal Auth Guard Helper ────────────────────────────────────────────────

async function verifyAdminContext() {
  const session = await getSession();
  if (!session || !session.profile?.school_id) return null;

  // Align clearance matching exactly with user_role structure
  const isAuthorized = session.profile.base_role === "admin" || session.profile.is_super_admin;
  if (!isAuthorized) return null;

  return {
    schoolId: session.profile.school_id as string,
    userId: session.profile.id as string,
  };
}

// ── Read ──────────────────────────────────────────────────────────────────────

// ── Read ──────────────────────────────────────────────────────────────────────

export async function fetchSchoolSettings(): Promise<SchoolSettings | null> {
  const session = await getSession();
  if (!session || !session.profile?.school_id) return null;

  const schoolId = session.profile.school_id as string;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error) {
    console.error("[fetchSchoolSettings] error:", error.message);
    return null;
  }

  // ── Auto-provision defaults for freshly onboarded schools ────────────────
  if (!data) {
    const defaults = {
      school_id: schoolId,
      school_name: "Kibali Academy",
      current_term: 1,
      current_academic_year: new Date().getFullYear(),
      sms_notifications_enabled: true,
      email_notifications_enabled: true,
    };

    // FIX: Execute the system auto-provisioning step using the service role admin client
    const { data: provisioned, error: insertError } = await supabaseAdmin
      .from("system_settings")
      .insert(defaults)
      .select()
      .single();

    if (insertError) {
      console.error("[fetchSchoolSettings] auto-provision failed:", insertError.message);
      return null;
    }

    return provisioned as SchoolSettings;
  }

  return data as SchoolSettings;
}

// ── Validation Schema ─────────────────────────────────────────────────────────

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
  term_start_date: z.string().optional().nullable(),
  term_end_date: z.string().optional().nullable(),
  next_term_opening_date: z.string().optional().nullable(),
  sms_notifications_enabled: z.boolean().default(true),
  email_notifications_enabled: z.boolean().default(true),
});

// ── Update Settings ───────────────────────────────────────────────────────────

export async function updateSchoolSettings(
  formData: FormData,
): Promise<SettingsActionResult> {
  const adminContext = await verifyAdminContext();
  if (!adminContext) return { success: false, message: "Unauthorised access attempt." };

  const { schoolId, userId } = adminContext;

  const raw = {
    school_name:                 formData.get("school_name"),
    school_motto:                formData.get("school_motto")                 || null,
    school_address:              formData.get("school_address")               || null,
    school_phone:                formData.get("school_phone")                 || null,
    school_email:                formData.get("school_email")                 || null,
    current_term:                formData.get("current_term"),
    current_academic_year:       formData.get("current_academic_year"),
    term_start_date:             formData.get("term_start_date")              || null,
    term_end_date:               formData.get("term_end_date")                || null,
    next_term_opening_date:      formData.get("next_term_opening_date")       || null,
    sms_notifications_enabled:   formData.get("sms_notifications_enabled")   === "true",
    email_notifications_enabled: formData.get("email_notifications_enabled")  === "true",
  };

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, message: first?.message ?? "Invalid configuration parameters." };
  }

  const supabase = await createSupabaseServerClient();
  
  // Using upsert ensures safety for freshly provisioned schools without initial settings entries
  const { error } = await supabase
    .from("system_settings")
    .upsert({
      school_id: schoolId,
      ...parsed.data,
      updated_by: userId,
    });

  if (error) {
    console.error("[updateSchoolSettings] mutation error:", error.message);
    return { success: false, message: "Failed to save operational parameters." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true, message: "Settings saved and synchronized successfully." };
}

// ── Upload Logo ───────────────────────────────────────────────────────────────

export async function uploadSchoolLogo(
  formData: FormData,
): Promise<SettingsActionResult & { logo_url?: string }> {
  const adminContext = await verifyAdminContext();
  if (!adminContext) return { success: false, message: "Unauthorised access attempt." };

  const { schoolId, userId } = adminContext;

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    return { success: false, message: "No file provided" };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { success: false, message: "Logo must be under 2 MB" };
  }

  if (!["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.type)) {
    return { success: false, message: "Logo must be PNG, JPEG, WEBP, or SVG" };
  }

  const ext = file.name.split(".").pop() ?? "png";
  
  // FIX: Isolated tenant storage bucket subpath to prevent image cross-contamination
  const path = `schools/${schoolId}/logo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("school-assets")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error("[uploadSchoolLogo] storage error:", uploadError.message);
    return { success: false, message: "Logo asset upload failed." };
  }

  const supabase = await createSupabaseServerClient();
  const { error: updateError } = await supabase
    .from("system_settings")
    .update({ logo_url: path, updated_by: userId })
    .eq("school_id", schoolId);

  if (updateError) {
    console.error("[uploadSchoolLogo] settings update error:", updateError.message);
    return { success: false, message: "Logo saved to storage but database tracking link failed." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return {
    success: true,
    message: "Logo updated successfully.",
    logo_url: path,
  };
}