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
import { supabaseAdmin } from "../supabase/admin";
import { resolveAllRoles, resolvePrimaryRole } from "./auth-utils";

export interface AuthActionResult {
  success: boolean;
  message: string;
  redirectTo?: string;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function loginAction(
  formData: FormData,
): Promise<AuthActionResult> {
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
    if (error.message.toLowerCase().includes("invalid login")) {
      return { success: false, message: "Incorrect email or password." };
    }
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        success: false,
        message: "Please verify your email address before signing in.",
      };
    }
    return { success: false, message: "Sign-in failed. Please try again." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { success: false, message: "Session error. Please try again." };

  // Fetch BOTH role fields so multi-role users land on the right dashboard
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", user.id)
    .single();

  const primaryRole = resolvePrimaryRole(profile);

  // Check if parent hasn't completed onboarding (invite_accepted = false)
  // Redirect them to complete password setup before accessing the portal
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

  const email = parsed.data.email;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  // Generate a recovery link via the admin client so we can send our own
  // branded Resend email instead of Supabase's default template.
  // The link uses the Fragment (Format B) token flow handled by /auth/confirm.
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/auth/confirm` },
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

  // Fetch display name for a personalised email (best-effort)
  let recipientName = email.split("@")[0] ?? "there";
  try {
    const { data: profileRow } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", linkData.user.id)
      .maybeSingle();
    if (profileRow?.full_name) recipientName = profileRow.full_name;
  } catch {
    /* non-blocking — proceed without name */
  }

  await sendPasswordResetEmail({
    recipientEmail: email,
    recipientName,
    resetLink: linkData.properties.action_link,
    isFirstSetup: false,
  });

  return SAFE_RESPONSE;
}

// ── Reset password (called from /auth/reset-password after invite link) ───────

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

  // Get the current user — session was established by /auth/confirm
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

  // Update the password
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    if (error.message.toLowerCase().includes("same password")) {
      return {
        success: false,
        message: "New password must be different from your current password.",
      };
    }
    return {
      success: false,
      message:
        "Failed to update password. The setup link may have expired — please contact the school office.",
    };
  }

  // Mark invite_accepted = true so the parent can now log in normally
  // Use admin client to bypass RLS (parents can't update their own row by default)
  await supabaseAdmin
    .from("parents")
    .update({ invite_accepted: true })
    .eq("id", user.id);

  // Fetch primary role to send parent directly to the right portal
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, roles")
    .eq("id", user.id)
    .single();

  const primaryRole = resolvePrimaryRole(profile);
  const destination = ROLE_ROUTES[primaryRole] ?? "/parent/portal";

  revalidatePath("/", "layout");

  // Return the destination — the client (reset-password page) handles the
  // toast then navigates. Parent is ALREADY logged in — no second login needed.
  return {
    success: true,
    message: "Password set successfully! Welcome to Kibali Academy.",
    redirectTo: destination,
  };
}

// ── Get current session (for Server Components) ───────────────────────────────

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
