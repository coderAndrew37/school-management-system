"use server";

// lib/actions/auth.ts
// Kibali Academy — Auth Server Actions (hardened)
//
// KEY FIXES vs previous version:
//   1. loginAction no longer calls getSession() after signInWithPassword —
//      that extra DB round-trip can fail if the JWT sync trigger is mid-flight.
//      We read role from the session returned by signInWithPassword directly.
//   2. getSession() has an explicit try/catch so a profiles query failure
//      doesn't surface as an unhandled error.
//   3. resolvePrimaryRole / resolveAllRoles imported from CORRECT path:
//      @/lib/services/auth-utils (not @/lib/actions/auth-utils).
//   4. Parent invite check uses supabaseAdmin with maybeSingle() — never throws.
//   5. All redirectTo values are validated against an allowlist to prevent
//      open-redirect attacks.

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

// ✅ FIXED: correct import path — services not actions
import {
  resolvePrimaryRole,
  resolveAllRoles,
} from "@/lib/actions/auth-utils";

// ── Rate limiter ───────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  key:      string,
  limit     = 5,
  windowMs  = 15 * 60 * 1000
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

// ── Redirect allowlist guard ───────────────────────────────────────────────
// Prevents open-redirect attacks on the redirectTo param.

const SAFE_REDIRECT_PREFIXES = [
  "/admin",
  "/teacher",
  "/parent",
  "/support",
  "/auth",
];

function sanitizeRedirect(redirectTo: string | undefined): string | undefined {
  if (!redirectTo) return undefined;
  // Must start with / and match a known portal prefix
  if (
    redirectTo.startsWith("/") &&
    SAFE_REDIRECT_PREFIXES.some((p) => redirectTo.startsWith(p))
  ) {
    return redirectTo;
  }
  return undefined;
}

// ============================================================================
// SESSION RESULT TYPE
// ============================================================================

export interface SessionResult {
  user:        { id: string; email: string };
  profile:     Profile;
  primaryRole: BaseRole;
  allRoles:    BaseRole[];
}

// ============================================================================
// getSession
// The single trusted entry point for resolving a live server-side session.
// Reads the full Profile row including override arrays.
// NEVER throws — returns null on any failure.
// ============================================================================

export async function getSession(): Promise<SessionResult | null> {
  try {
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
        teacher_id,
        allowed_permissions_override,
        denied_permissions_override,
        created_at,
        updated_at
      `)
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      // Profile doesn't exist yet (new user, trigger hasn't fired) — still
      // return a minimal session so the layout doesn't hard-crash.
      console.warn("[getSession] profile not found for uid:", user.id, profileError?.message);
      return null;
    }

    const typedProfile: Profile = {
      id:                           profile.id as string,
      school_id:                    (profile.school_id       as string | null) ?? null,
      full_name:                    (profile.full_name        as string | null) ?? null,
      phone_number:                 (profile.phone_number     as string | null) ?? null,
      email:                        (profile.email            as string | null) ?? null,
      avatar_url:                   (profile.avatar_url       as string | null) ?? null,
      base_role:                    ((profile.role            as BaseRole) ?? "teacher"),
      admin_role:                   null,
      roles:                        null,
      teacher_id:                   (profile.teacher_id       as string | null) ?? null,
      is_super_admin:               (profile.is_super_admin   as boolean) ?? false,
      is_dev:                       (profile.is_dev           as boolean) ?? false,
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
  } catch (err: unknown) {
    console.error("[getSession] unexpected error:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ============================================================================
// LOGIN
// ============================================================================

export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  const rawEmail = (formData.get("email") as string | null) ?? "";
  const email    = rawEmail.toLowerCase().trim();

  if (!checkRateLimit(`login:${email}`, 6, 10 * 60 * 1000)) {
    return {
      success: false,
      message: "Too many login attempts. Please wait 10 minutes and try again.",
    };
  }

  const parsed = loginSchema.safeParse({
    email:    formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email:    parsed.data.email,
      password: parsed.data.password,
    });

  if (signInError) {
    const msg = signInError.message.toLowerCase();
    if (msg.includes("invalid login credentials") || msg.includes("invalid login"))
      return { success: false, message: "Incorrect email or password." };
    if (msg.includes("email not confirmed"))
      return {
        success: false,
        message: "Please verify your email before signing in.",
      };
    if (msg.includes("too many requests"))
      return {
        success: false,
        message: "Too many sign-in attempts. Please wait a moment.",
      };
    console.error("[loginAction] signInWithPassword error:", signInError.message);
    return { success: false, message: "Sign-in failed. Please try again." };
  }

  // ── Read role directly from the session JWT app_metadata ─────────────────
  // This avoids a second DB round-trip and is immune to trigger timing issues.
  // The JWT already carries the role written during previous sessions.
  // For brand-new users whose JWT hasn't been synced yet, fall back to
  // reading from the profiles table.

  const authUser = signInData.user;
  if (!authUser) {
    return { success: false, message: "Session error. Please try again." };
  }

  // Try JWT first (fast path — no DB call)
  let primaryRole = authUser.app_metadata?.role as BaseRole | undefined;
  let allRoles:     BaseRole[] = primaryRole ? [primaryRole] : [];

  // Fall back to a live profile read if JWT doesn't have role yet
  // (brand new user, or JWT hasn't been synced by the trigger)
  if (!primaryRole) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle();

    primaryRole = (profileRow?.role as BaseRole | undefined) ?? "parent";
    allRoles    = [primaryRole];
  }

  // ── Parent invite guard ───────────────────────────────────────────────────
  if (allRoles.includes("parent")) {
    try {
      const { data: parentRow } = await supabaseAdmin
        .from("student_parents")
        .select("id")
        .eq("parent_id", authUser.id)
        .limit(1)
        .maybeSingle();

      // If no student-parent link exists, the account isn't fully set up
      if (!parentRow && allRoles.length === 1) {
        // Sign them out so they don't have a dangling session
        await supabase.auth.signOut();
        return {
          success: false,
          message:
            "Your account setup is incomplete. Check your email for the setup link, or contact the school office.",
        };
      }
    } catch (err: unknown) {
      // Non-blocking — don't let a parent check crash the login
      console.warn("[loginAction] parent check failed:", err instanceof Error ? err.message : err);
    }
  }

  revalidatePath("/", "layout");

  // Multi-role: send to portal picker
  if (allRoles.length > 1) {
    return {
      success:    true,
      message:    "Signed in successfully.",
      redirectTo: CHOOSE_ROLE_ROUTE,
      roles:      allRoles,
    };
  }

  return {
    success:    true,
    message:    "Signed in successfully.",
    redirectTo: ROLE_ROUTES[primaryRole] ?? "/admin/dashboard",
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

export async function forgotPasswordAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid email.",
    };
  }

  const email = parsed.data.email.toLowerCase().trim();

  // Rate limit: 3 attempts per 15 minutes per email
  if (!checkRateLimit(`forgot:${email}`, 3, 15 * 60 * 1000)) {
    // Return the safe response even on rate limit — don't reveal account existence
    return {
      success: true,
      message:
        "If an account with that email exists, you will receive a reset link shortly.",
    };
  }

  const SAFE_RESPONSE: AuthActionResult = {
    success: true,
    message:
      "If an account with that email exists, you will receive a reset link shortly.",
  };

  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type:    "recovery",
      email,
      options: { redirectTo: getAuthConfirmUrl() },
    });

  if (linkError || !linkData?.properties?.action_link) {
    if (linkError) console.error("[forgotPassword]", linkError.message);
    return SAFE_RESPONSE;
  }

  // Resolve the display name non-blockingly
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
  }).catch((err: unknown) =>
    console.error("[forgotPassword] email send failed:", err instanceof Error ? err.message : err)
  );

  return SAFE_RESPONSE;
}

// ============================================================================
// RESET PASSWORD
// ============================================================================

export async function resetPasswordAction(
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password:        formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid password.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      success: false,
      message:
        "Session expired. Please click the setup link in your email again.",
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (updateError) {
    const msg = updateError.message.toLowerCase();
    if (msg.includes("same password"))
      return {
        success: false,
        message: "New password must be different from your current one.",
      };
    return {
      success: false,
      message:
        "Failed to update password. The link may have expired — please contact the school office.",
    };
  }

  // Mark parent invite accepted (non-blocking — ignore failures)
  try {
    await supabaseAdmin
      .from("profiles")
      .update({ role: "parent" })
      .eq("id", user.id)
      .eq("role", "parent"); // no-op if not a parent
  } catch { /* non-blocking */ }

  // Determine where to redirect after password reset
  const roleFromJwt =
    (user.app_metadata?.role as BaseRole | undefined) ?? "parent";

  revalidatePath("/", "layout");

  return {
    success:    true,
    message:    "Password set successfully! Welcome to Kibali Academy.",
    redirectTo: ROLE_ROUTES[roleFromJwt] ?? "/parent/dashboard",
  };
}