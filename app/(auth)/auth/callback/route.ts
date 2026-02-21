import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/auth";
import { ROLE_ROUTES } from "@/lib/types/auth";

/**
 * GET /auth/callback
 *
 * Supabase PKCE flow sends the user here after:
 * - Email confirmation (sign-up)
 * - Password reset (sends a recovery link)
 * - Magic link sign-in
 *
 * The `code` query param is exchanged for a session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // 'recovery' | 'signup' | undefined
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    // No code — redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("PKCE code exchange error:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=auth_error&message=${encodeURIComponent(error.message)}`,
    );
  }

  // For password recovery — redirect to the reset password page
  if (type === "recovery") {
    // Ensure this matches where you create the reset-password page
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  // For all other cases — load the user's role and redirect to their dashboard
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role ?? "parent") as UserRole;

  // If there was a specific redirect target, honour it (if role allows)
  if (next && next !== "/") {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}${ROLE_ROUTES[role]}`);
}
