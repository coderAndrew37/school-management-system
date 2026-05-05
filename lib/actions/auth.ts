"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/auth";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  ROLE_ROUTES,
} from "@/lib/types/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendPasswordResetEmail } from "../mail";
import { resolveAllRoles, resolvePrimaryRole } from "./auth-utils";
import { supabaseAdmin } from "../supabase/admin";
import { getAuthConfirmUrl } from "@/lib/utils/site-url";

// Simple in-memory rate limiter (good enough for a school system)
// For production with high traffic, replace with Upstash Redis or similar
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}

export interface AuthActionResult {
  success: boolean;
  message: string;
  redirectTo?: string;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const email = (formData.get("email") as string)?.toLowerCase().trim();

  // Rate limiting
  if (!checkRateLimit(`login:${email}`, 6, 10 * 60 * 1000)) {
    return {
      success: false,
      message: "Too many login attempts. Please try again in 10 minutes.",
    };
  }

  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("invalid login"))
      return { success: false, message: "Incorrect email or password." };

    if (error.message.toLowerCase().includes("email not confirmed"))
      return {
        success: false,
        message: "Please verify your email address before signing in.",
      };

    return { success: false, message: "Sign-in failed. Please try again." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Session error. Please try again." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", user.id)
    .single();

  const primaryRole = resolvePrimaryRole(profile);

  // Block parents who haven't completed setup
  if (primaryRole === "parent") {
    const { data: parentRow } = await supabaseAdmin
      .from("parents")
      .select("invite_accepted")
      .eq("id", user.id)
      .maybeSingle();

    if (parentRow && parentRow.invite_accepted === false) {
      return {
        success: false,
        message:
          "Your account setup is incomplete. Please check your email for the setup link, or contact the school office to resend it.",
      };
    }
  }

  revalidatePath("/", "layout");
  return {
    success: true,
    message: "Signed in successfully.",
    redirectTo: ROLE_ROUTES[primaryRole],
  };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ── Forgot password ───────────────────────────────────────────────────────────

export async function forgotPasswordAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const raw = { email: formData.get("email") };
  const parsed = forgotPasswordSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid email",
    };
  }

  const email = parsed.data.email.toLowerCase().trim();

  // Rate limiting
  if (!checkRateLimit(`forgot:${email}`, 3, 15 * 60 * 1000)) {
    return {
      success: true, // Always return success for security
      message: "If an account with that email exists, you will receive a reset link within a few minutes.",
    };
  }

  // Use "recovery" type (more semantic for password reset)
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",                    // ← Changed from magiclink
      email,
      options: { redirectTo: getAuthConfirmUrl() },
    });

  // Always respond identically — never reveal whether the address exists.
  const SAFE_RESPONSE: AuthActionResult = {
    success: true,
    message:
      "If an account with that email exists, you will receive a reset link within a few minutes.",
  };

  if (linkError || !linkData?.properties?.action_link) {
    if (linkError)
      console.error("[forgotPassword] generateLink error:", linkError.message);
    return SAFE_RESPONSE;
  }

  // Fetch display name for personalised email
  let recipientName = email.split("@")[0] ?? "there";
  try {
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", linkData.user.id)
      .maybeSingle();

    if (profileRow?.full_name) recipientName = profileRow.full_name;
  } catch {
    /* non-blocking */
  }

  await sendPasswordResetEmail({
    recipientEmail: email,
    recipientName,
    resetLink: linkData.properties.action_link,
    isFirstSetup: false,
  }).catch(console.error);

  return SAFE_RESPONSE;
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetPasswordAction(
  formData: FormData,
): Promise<AuthActionResult> {
  const raw = {
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid password",
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

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("same password"))
      return {
        success: false,
        message: "New password must be different from your current password.",
      };

    return {
      success: false,
      message: "Failed to update password. The setup link may have expired — please contact the school office.",
    };
  }

  // Mark invite as accepted for parents
  await supabaseAdmin
    .from("parents")
    .update({ invite_accepted: true })
    .eq("id", user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", user.id)
    .single();

  const primaryRole = resolvePrimaryRole(profile);
  const destination = ROLE_ROUTES[primaryRole] ?? "/parent";

  revalidatePath("/", "layout");

  return {
    success: true,
    message: "Password set successfully! Welcome to Kibali Academy.",
    redirectTo: destination,
  };
}

// ── Get current session ───────────────────────────────────────────────────────

export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    user,
    profile: profile as Profile,
    primaryRole: resolvePrimaryRole(profile),
    allRoles: resolveAllRoles(profile),
  };
}