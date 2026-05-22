"use server";

// lib/actions/auth.ts
// Kibali Academy — Auth Server Actions
//
// getSession() is the single trusted entry point for resolving a live
// server-side session. It always reads from Supabase (not stale JWT cache)
// and returns the full Profile with override arrays.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin }              from "@/lib/supabase/admin";
import { revalidatePath }             from "next/cache";
import { redirect }                   from "next/navigation";
import { sendPasswordResetEmail }     from "@/lib/mail";
import { getAuthConfirmUrl }          from "@/lib/utils/site-url";

import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  ROLE_ROUTES,
  CHOOSE_ROLE_ROUTE,
  type BaseRole,
  type Profile,
  type AuthActionResult,
} from "@/lib/types/auth";

import {
  resolvePrimaryRole,
  resolveAllRoles,
} from "@/lib/actions/auth-utils";

// ── Rate limiter (in-process, stateless between cold starts) ─────────────────

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  key: string,
  limit   = 5,
  windowMs = 15 * 60 * 1000
): boolean {
  const now    = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= limit) return false;
  record.count++;
  return true;
}

// ============================================================================
// getSession — primary session resolver used by layouts and server actions
// ============================================================================

export interface SessionResult {
  user: { id: string; email: string };
  profile: Profile;
  primaryRole: BaseRole;
  allRoles: BaseRole[];
}

/**
 * Resolves the live server-side session. Reads the full Profile row including
 * allowed_permissions_override and denied_permissions_override.
 *
 * Returns null if unauthenticated or profile missing.
 * Never throws — callers check for null and redirect.
 */
export async function getSession(): Promise<SessionResult | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(`
      id,
      school_id,
      full_name,
      phone_number,
      email,
      avatar_url,
      role,
      is_super_admin,
      is_dev,
      allowed_permissions_override,
      denied_permissions_override,
      created_at,
      updated_at
    `)
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;

  // Map DB row to our Profile interface shape
  const typedProfile: Profile = {
    id:                           profile.id as string,
    school_id:                    (profile.school_id as string | null) ?? null,
    full_name:                    (profile.full_name as string | null) ?? null,
    phone_number:                 (profile.phone_number as string | null) ?? null,
    email:                        (profile.email as string | null) ?? null,
    avatar_url:                   (profile.avatar_url as string | null) ?? null,
    // DB stores `role` (user_role enum); our Profile uses `base_role` name convention
    base_role:                    (profile.role as BaseRole) ?? "teacher",
    admin_role:                   null,   // resolved from staff_role_assignments if needed
    roles:                        null,
    teacher_id:                   null,
    is_super_admin:               (profile.is_super_admin as boolean) ?? false,
    is_dev:                       (profile.is_dev as boolean)         ?? false,
    allowed_permissions_override: (profile.allowed_permissions_override as string[] | null) ?? [],
    denied_permissions_override:  (profile.denied_permissions_override  as string[] | null) ?? [],
    created_at:                   profile.created_at as string,
    updated_at:                   profile.updated_at as string,
  };

  return {
    user:        { id: user.id, email: user.email ?? "" },
    profile:     typedProfile,
    primaryRole: resolvePrimaryRole(typedProfile),
    allRoles:    resolveAllRoles(typedProfile),
  };
}

// ============================================================================
// LOGIN
// ============================================================================

export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  const email = ((formData.get("email") as string) ?? "").toLowerCase().trim();

  if (!checkRateLimit(`login:${email}`, 6, 10 * 60 * 1000)) {
    return { success: false, message: "Too many login attempts. Please try again in 10 minutes." };
  }

  const parsed = loginSchema.safeParse({
    email:    formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email:    parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("invalid login"))
      return { success: false, message: "Incorrect email or password." };
    if (error.message.toLowerCase().includes("email not confirmed"))
      return { success: false, message: "Please verify your email before signing in." };
    return { success: false, message: "Sign-in failed. Please try again." };
  }

  const session = await getSession();
  if (!session) return { success: false, message: "Session error. Please try again." };

  const { allRoles, primaryRole } = session;

  // Parent invite guard
  if (allRoles.includes("parent")) {
    const { data: parentRow } = await supabaseAdmin
      .from("parents")
      .select("invite_accepted")
      .eq("id", session.user.id)
      .maybeSingle();

    if (parentRow?.invite_accepted === false) {
      if (allRoles.length === 1) {
        return {
          success: false,
          message: "Your account setup is incomplete. Check your email for the setup link.",
        };
      }
    }
  }

  revalidatePath("/", "layout");

  if (allRoles.length > 1) {
    return { success: true, message: "Signed in successfully.", redirectTo: CHOOSE_ROLE_ROUTE, roles: allRoles };
  }

  return {
    success:    true,
    message:    "Signed in successfully.",
    redirectTo: ROLE_ROUTES[primaryRole] ?? "/login",
  };
}

// ============================================================================
// LOGOUT
// ============================================================================

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ============================================================================
// FORGOT PASSWORD
// ============================================================================

export async function forgotPasswordAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid email." };
  }

  const email = parsed.data.email.toLowerCase().trim();

  if (!checkRateLimit(`forgot:${email}`, 3, 15 * 60 * 1000)) {
    return { success: true, message: "If an account with that email exists, you will receive a reset link shortly." };
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type:    "recovery",
    email,
    options: { redirectTo: getAuthConfirmUrl() },
  });

  const SAFE: AuthActionResult = {
    success: true,
    message: "If an account with that email exists, you will receive a reset link shortly.",
  };

  if (linkError || !linkData?.properties?.action_link) {
    if (linkError) console.error("[forgotPassword]", linkError.message);
    return SAFE;
  }

  let recipientName = email.split("@")[0] ?? "there";
  try {
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", linkData.user.id)
      .maybeSingle();
    if (p?.full_name) recipientName = p.full_name as string;
  } catch { /* non-blocking */ }

  await sendPasswordResetEmail({
    recipientEmail: email,
    recipientName,
    resetLink:      linkData.properties.action_link,
    isFirstSetup:   false,
  }).catch(console.error);

  return SAFE;
}

// ============================================================================
// RESET PASSWORD
// ============================================================================

export async function resetPasswordAction(formData: FormData): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password:        formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, message: "Session expired. Please click the setup link in your email again." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    if (error.message.toLowerCase().includes("same password"))
      return { success: false, message: "New password must be different from your current password." };
    return { success: false, message: "Failed to update password. The link may have expired — please contact the school office." };
  }

  // Mark parent invite accepted
  await supabaseAdmin
    .from("parents")
    .update({ invite_accepted: true })
    .eq("id", user.id);

  const session = await getSession();
  revalidatePath("/", "layout");

  return {
    success:    true,
    message:    "Password set successfully! Welcome to Kibali Academy.",
    redirectTo: ROLE_ROUTES[session?.primaryRole ?? "parent"] ?? "/parent/dashboard",
  };
}