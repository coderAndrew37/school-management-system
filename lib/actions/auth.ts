"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type UserRole,
  ROLE_ROUTES,
} from "@/lib/types/auth";
import type { Profile } from "@/lib/types/auth";

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
      message: parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Never expose internal error details to the client
    if (error.message.toLowerCase().includes("invalid login")) {
      return { success: false, message: "Incorrect email or password." };
    }
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return {
        success: false,
        message:
          "Please verify your email address before signing in. Check your inbox.",
      };
    }
    return { success: false, message: "Sign-in failed. Please try again." };
  }

  // Fetch profile to get role for redirect
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return { success: false, message: "Session error. Please try again." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role ?? "parent") as UserRole;
  revalidatePath("/", "layout");

  return {
    success: true,
    message: "Signed in successfully.",
    redirectTo: ROLE_ROUTES[role],
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
      message: parsed.error.errors[0]?.message ?? "Invalid email",
    };
  }

  const supabase = await createSupabaseServerClient();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${siteUrl}/auth/callback?type=recovery`,
    },
  );

  if (error) {
    console.error("forgotPassword error:", error.message);
    // Always return a success-like message to prevent email enumeration
  }

  // Always respond the same way — don't reveal whether the email exists
  return {
    success: true,
    message:
      "If an account with that email exists, you will receive a password reset link within a few minutes.",
  };
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
      message: parsed.error.errors[0]?.message ?? "Invalid password",
    };
  }

  const supabase = await createSupabaseServerClient();

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
      message: "Failed to update password. The reset link may have expired.",
    };
  }

  revalidatePath("/", "layout");
  return {
    success: true,
    message: "Password updated successfully. You are now signed in.",
    redirectTo: "/login",
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
  };
}
