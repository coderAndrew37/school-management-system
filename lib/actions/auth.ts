"use server";

// lib/actions/auth.ts
// Kibali Academy — Auth Server Actions (hardened)

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendPasswordResetEmail } from "@/lib/mail";
import { getAuthConfirmUrl } from "@/lib/utils/site-url";

import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  ROLE_ROUTES,
  CHOOSE_ROLE_ROUTE,
  toBaseRoleArray,
  isBaseRole,
  type BaseRole,
  type Profile,
  type SessionResult,
  type AuthActionResult,
} from "@/lib/types/auth";

import { resolveAllRoles } from "@/lib/actions/auth-utils";

// ── Rate limiter ───────────────────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(
  key: string,
  limit = 5,
  windowMs = 15 * 60 * 1000
): boolean {
  const now = Date.now();
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
// getSession
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
      .select(
        `
        id,
        school_id,
        full_name,
        phone_number,
        email,
        avatar_url,
        base_role,
        admin_role,
        is_super_admin,
        is_dev,
        teacher_id,
        allowed_permissions_override,
        denied_permissions_override,
        created_at,
        updated_at
      `
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.warn(
        "[getSession] profile not found for uid:",
        user.id,
        profileError?.message
      );
      return null;
    }

    // Canonical mapping for everything except portal set.
    const typedProfile: Profile = {
      id: profile.id as string,
      school_id: (profile.school_id as string | null) ?? null,
      full_name: (profile.full_name as string | null) ?? null,
      phone_number: (profile.phone_number as string | null) ?? null,
      email: (profile.email as string | null) ?? null,
      avatar_url: (profile.avatar_url as string | null) ?? null,
      base_role: (isBaseRole(profile.base_role) ? profile.base_role : "parent") as BaseRole,
      admin_role: (profile.admin_role as string | null) ?? null,
      teacher_id: (profile.teacher_id as string | null) ?? null,
      is_super_admin: (profile.is_super_admin as boolean) ?? false,
      is_dev: (profile.is_dev as boolean) ?? false,
      allowed_permissions_override:
        (profile.allowed_permissions_override as string[] | null) ?? [],
      denied_permissions_override:
        (profile.denied_permissions_override as string[] | null) ?? [],
      created_at: profile.created_at as string,
      updated_at: profile.updated_at as string,
    };

    // ── Portal set: base_role + JWT accessible_portals (sync_user_jwt_claims) ──
    const meta = user.app_metadata ?? {};
    const allRoles = resolveAllRoles({
      base_role: typedProfile.base_role,
      accessible_portals: toBaseRoleArray(meta.accessible_portals),
      is_super_admin: typedProfile.is_super_admin,
    });

    const primaryRole = allRoles[0] ?? "parent";

    return {
      user: { id: user.id, email: user.email ?? "" },
      profile: typedProfile,
      primaryRole,
      allRoles,
    };
  } catch (err: unknown) {
    console.error(
      "[getSession] unexpected error:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ============================================================================
// LOGIN
// ============================================================================

export async function loginAction(formData: FormData): Promise<AuthActionResult> {
  const rawEmail = (formData.get("email") as string | null) ?? "";
  const email = rawEmail.toLowerCase().trim();

  if (!checkRateLimit(`login:${email}`, 6, 10 * 60 * 1000)) {
    return {
      success: false,
      message: "Too many login attempts. Please wait 10 minutes and try again.",
    };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
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
      email: parsed.data.email,
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

  const authUser = signInData.user;
  if (!authUser) {
    return { success: false, message: "Session error. Please try again." };
  }

  // ── Resolve base_role + accessible_portals ────────────────────────────────
  // 1. Primary source: fresh JWT app_metadata custom claims (just issued, always current).
  const meta = authUser.app_metadata ?? {};

  let baseRole: BaseRole | undefined = isBaseRole(meta.base_role)
    ? (meta.base_role as BaseRole)
    : undefined;

  let accessiblePortals: BaseRole[] = toBaseRoleArray(meta.accessible_portals);

  // 2. Legacy claim fallback (deprecated keys, in case trigger hasn't migrated yet).
  if (!baseRole && isBaseRole(meta.role)) {
    baseRole = meta.role as BaseRole;
  }
  if (accessiblePortals.length === 0) {
    accessiblePortals = toBaseRoleArray(meta.roles);
  }

  // 3. Full DB fallback — base_role + is_super_admin only.
  //    profiles.roles is legacy/deprecated and is NOT a reliable superset source;
  //    if accessible_portals is missing from the JWT at this point, the safest
  //    fallback is a single-portal session (the user can re-login once
  //    sync_user_jwt_claims has run to populate the full claim).
  if (!baseRole || accessiblePortals.length === 0) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("base_role, is_super_admin")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!baseRole) {
      baseRole = isBaseRole(profileRow?.base_role)
        ? (profileRow.base_role as BaseRole)
        : "parent";
    }

    if (accessiblePortals.length === 0) {
      accessiblePortals = [baseRole];
    }

    if (profileRow?.is_super_admin === true && !accessiblePortals.includes("super_admin")) {
      accessiblePortals = ["super_admin", ...accessiblePortals];
    }
  }

  // 4. Always ensure baseRole is itself represented in accessiblePortals.
  if (!accessiblePortals.includes(baseRole)) {
    accessiblePortals = [baseRole, ...accessiblePortals];
  }

  // De-duplicate while preserving order.
  accessiblePortals = Array.from(new Set(accessiblePortals));

  // 5. Parent-setup integrity check — only block if "parent" is the SOLE accessible portal.
  if (accessiblePortals.includes("parent")) {
    try {
      const { data: parentRow } = await supabaseAdmin
        .from("student_parents")
        .select("id")
        .eq("parent_id", authUser.id)
        .limit(1)
        .maybeSingle();

      if (!parentRow && accessiblePortals.length === 1 && accessiblePortals[0] === "parent") {
        await supabase.auth.signOut();
        return {
          success: false,
          message:
            "Your account setup is incomplete. Check your email for the setup link, or contact the school office.",
        };
      }
    } catch (err: unknown) {
      console.warn(
        "[loginAction] parent check failed:",
        err instanceof Error ? err.message : err
      );
    }
  }

  revalidatePath("/", "layout");

  // ── Multi-portal routing ───────────────────────────────────────────────────
  if (accessiblePortals.length > 1) {
    return {
      success: true,
      message: "Signed in successfully.",
      redirectTo: CHOOSE_ROLE_ROUTE,
      roles: accessiblePortals,
    };
  }

  return {
    success: true,
    message: "Signed in successfully.",
    redirectTo: ROLE_ROUTES[baseRole] ?? ROLE_ROUTES.parent,
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

  if (!checkRateLimit(`forgot:${email}`, 3, 15 * 60 * 1000)) {
    return {
      success: true,
      message: "If an account with that email exists, you will receive a reset link shortly.",
    };
  }

  const SAFE_RESPONSE: AuthActionResult = {
    success: true,
    message: "If an account with that email exists, you will receive a reset link shortly.",
  };

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: getAuthConfirmUrl() },
  });

  if (linkError || !linkData?.properties?.action_link) {
    if (linkError) console.error("[forgotPassword]", linkError.message);
    return SAFE_RESPONSE;
  }

  let recipientName = email.split("@")[0] ?? "there";
  try {
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", linkData.user.id)
      .maybeSingle();
    if (p?.full_name) recipientName = p.full_name as string;
  } catch {
    /* non-blocking */
  }

  await sendPasswordResetEmail({
    recipientEmail: email,
    recipientName,
    resetLink: linkData.properties.action_link,
    isFirstSetup: false,
  }).catch((err: unknown) =>
    console.error(
      "[forgotPassword] email send failed:",
      err instanceof Error ? err.message : err
    )
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
    password: formData.get("password"),
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
      message: "Session expired. Please click the setup link in your email again.",
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

  // No longer forcibly overwrite role here — base_role/roles are managed via
  // the RBAC admin flows, not implicitly on password reset.

  const meta = user.app_metadata ?? {};
  const roleFromJwt: BaseRole = isBaseRole(meta.base_role)
    ? (meta.base_role as BaseRole)
    : "parent";

  revalidatePath("/", "layout");

  return {
    success: true,
    message: "Password set successfully! Welcome to Kibali Academy.",
    redirectTo: ROLE_ROUTES[roleFromJwt] ?? ROLE_ROUTES.parent,
  };
}