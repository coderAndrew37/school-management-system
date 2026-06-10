// lib/actions/settings.ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyUserPermission } from "./permissions";
import { z } from "zod";

// ── Types & Action Interfaces ───────────────────────────────────────────────────

export interface SchoolSettings {
  id: string; // Internal system UUID primary key
  school_id: string; // Tenant reference constraint linked to schools table
  school_name: string;
  school_motto: string | null;
  school_address: string | null;
  school_phone: string | null;
  school_email: string | null;
  logo_url: string | null;
  current_term: 1 | 2 | 3;
  current_academic_year: number;
  
  // Explicit structural multi-term calendar milestones mapping layout
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

// ── Strict Validation Schema ─────────────────────────────────────────────────
const schoolSettingsSchema = z.object({
  school_name: z.string().min(1, "School name is required").max(120),
  school_motto: z.string().max(200).nullable().or(z.literal("").transform(() => null)),
  school_address: z.string().max(300).nullable().or(z.literal("").transform(() => null)),
  school_phone: z.string().max(30).nullable().or(z.literal("").transform(() => null)),
  school_email: z.string().email("Invalid institutional email structure").nullable().or(z.literal("").transform(() => null)),
  
  current_term: z.coerce.number().int().min(1).max(3),
  current_academic_year: z.coerce.number().int().min(2020).max(2040),
  
  term1_start: z.string().nullable().or(z.literal("").transform(() => null)),
  term1_end: z.string().nullable().or(z.literal("").transform(() => null)),
  term2_start: z.string().nullable().or(z.literal("").transform(() => null)),
  term2_end: z.string().nullable().or(z.literal("").transform(() => null)),
  term3_start: z.string().nullable().or(z.literal("").transform(() => null)),
  term3_end: z.string().nullable().or(z.literal("").transform(() => null)),
  
  sms_notifications_enabled: z.boolean().default(true),
  email_notifications_enabled: z.boolean().default(true),
});

// ── Read ──────────────────────────────────────────────────────────────────────
export async function fetchSchoolSettings(): Promise<SchoolSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data: profileData } = await supabase.auth.getUser();
  if (!profileData.user) return null;

  // Pull profile information to fetch school identifier link
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

  // Safe provisioning wrapper using bypassing client token layers
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

// ── Update Action ────────────────────────────────────────────────────────────
export async function updateSchoolSettings(
  formData: FormData
): Promise<SettingsActionResult> {
  // Determine which specific layout operational segment is submitting parameters
  const targetFormType = formData.get("__form_type") as "identity" | "calendar" | "notifications";
  const catalogKey = `settings.${targetFormType}.write`;

  // Verify access token clear paths via calculated hierarchy
  const { hasAccess, schoolId, userId } = await verifyUserPermission(catalogKey);
  if (!hasAccess) return { success: false, message: "Unauthorized resource access." };

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from("school_settings")
    .select("*")
    .eq("school_id", schoolId)
    .maybeSingle();

  // Route active input dates cleanly to their mapped columns based on the form configuration
  const formTerm = formData.get("current_term") ? Number(formData.get("current_term")) : (current?.current_term ?? 1);
  
  const raw = {
    school_name:    formData.get("school_name") ?? current?.school_name ?? "Kibali Academy",
    school_motto:   formData.get("school_motto") ?? current?.school_motto ?? "",
    school_address: formData.get("school_address") ?? current?.school_address ?? "",
    school_phone:   formData.get("school_phone") ?? current?.school_phone ?? "",
    school_email:   formData.get("school_email") ?? current?.school_email ?? "",
    
    current_term:   formTerm,
    current_academic_year: formData.get("current_academic_year") ?? current?.current_academic_year ?? "2026",

    // Contextual distribution checks: Preserve unsubmitted term data fields completely intact
    term1_start:    targetFormType === "calendar" && formTerm === 1 ? (formData.get("term_start_date") ?? "") : (current?.term1_start ?? ""),
    term1_end:      targetFormType === "calendar" && formTerm === 1 ? (formData.get("term_end_date") ?? "") : (current?.term1_end ?? ""),
    
    term2_start:    targetFormType === "calendar" && formTerm === 2 ? (formData.get("term_start_date") ?? "") : (current?.term2_start ?? ""),
    term2_end:      targetFormType === "calendar" && formTerm === 2 ? (formData.get("term_end_date") ?? "") : (current?.term2_end ?? ""),
    
    term3_start:    targetFormType === "calendar" && formTerm === 3 ? (formData.get("term_start_date") ?? "") : (current?.term3_start ?? ""),
    term3_end:      targetFormType === "calendar" && formTerm === 3 ? (formData.get("term_end_date") ?? "") : (current?.term3_end ?? ""),

    sms_notifications_enabled: formData.has("sms_notifications_enabled")
      ? formData.get("sms_notifications_enabled") === "true"
      : current?.sms_notifications_enabled ?? true,
    email_notifications_enabled: formData.has("email_notifications_enabled")
      ? formData.get("email_notifications_enabled") === "true"
      : current?.email_notifications_enabled ?? true,
  };

  const parsed = schoolSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Validation failed." };
  }

  // Update via administrative security client context to safely sidestep upsert loops
  const { error } = await supabaseAdmin
    .from("school_settings")
    .upsert({
      school_id: schoolId,
      ...parsed.data,
      updated_by: userId,
      updated_at: new Date().toISOString()
    }, { onConflict: "school_id" });

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
  // 1. Authorize file execution through the identity catalog domain write permissions
  const { hasAccess, schoolId } = await verifyUserPermission("settings.identity.write");
  if (!hasAccess) return { success: false, message: "Unauthorized asset access." };

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) {
    return { success: false, message: "No valid image file detected in form payload." };
  }

  // 2. Enforce structural limits (Max 2MB)
  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, message: "Asset file payload exceeds structural limit of 2MB." };
  }

  // Enforce explicit safe MIME boundaries
  const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { success: false, message: "Invalid asset format. Only PNG, JPEG, WEBP, or SVG are permitted." };
  }

  const supabase = await createSupabaseServerClient();
  
  // 3. Isolate the storage path by multi-tenant school_id reference matching
  // Using a clean extension resolver fallback
  const fileExtension = file.name.split(".").pop() ?? "png";
  const isolatedFilePath = `${schoolId}/logo-${Date.now()}.${fileExtension}`;

  // Execute storage upload to your bucket (assumed bucket identifier name: "school-logos")
  const { data: storageData, error: storageError } = await supabase.storage
    .from("school-logos")
    .upload(isolatedFilePath, file, {
      contentType: file.type,
      upsert: true,
    });

  if (storageError) {
    console.error("[uploadSchoolLogo] Supabase storage upload failure:", storageError.message);
    return { success: false, message: "Failed to persist media asset to remote cloud pipeline." };
  }

  // 4. Resolve the newly generated public URL link asset destination path cleanly
  const { data: linkResolution } = supabase.storage
    .from("school-logos")
    .getPublicUrl(isolatedFilePath);

  if (!linkResolution?.publicUrl) {
    return { success: false, message: "Failed to compute resource link layout references safely." };
  }

  const resolvedPublicUrl = linkResolution.publicUrl;

  // 5. Commit public URL path changes onto your public.school_settings schema configuration row
  const { error: dbError } = await supabaseAdmin
    .from("school_settings")
    .update({
      logo_url: resolvedPublicUrl,
      updated_at: new Date().toISOString()
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