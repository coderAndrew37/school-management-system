"use client";

/**
 * /app/auth/confirm/page.tsx
 *
 * Handles Supabase invite/recovery links.
 *
 * Supabase delivers tokens in the URL fragment (#access_token=...) which the
 * server can never read. This client page:
 *   1. Reads + parses the fragment
 *   2. Signs out any existing session first (prevents stale session conflicts)
 *   3. Calls setSession() to validate the recovery token
 *   4. Redirects to /auth/reset-password (session is live, updateUser will work)
 *
 * The parent is technically "logged in" at this point, but:
 *   - invite_accepted is still false
 *   - They have no password yet
 *   - resetPasswordAction sets the password AND marks invite_accepted = true,
 *     then redirects them directly to /parent/portal (no second login needed)
 */

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AuthConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    async function handleFragment() {
      const hash = window.location.hash.slice(1);
      if (!hash) {
        setErrorMessage(
          "No authentication tokens found in this link. It may be malformed or already used.",
        );
        setStatus("error");
        return;
      }

      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type"); // "recovery" for invite/reset links
      const errorDesc = params.get("error_description");

      // Supabase sometimes puts the error in the fragment itself
      if (errorDesc) {
        setErrorMessage(decodeURIComponent(errorDesc));
        setStatus("error");
        return;
      }

      if (!accessToken || !refreshToken) {
        setErrorMessage(
          "This link is missing required tokens. Please request a new invite from the school.",
        );
        setStatus("error");
        return;
      }

      // Sign out any stale session first — otherwise setSession may conflict
      // with a logged-in admin or teacher who clicked a parent invite link
      await supabase.auth.signOut();

      // Establish a session from the recovery/invite tokens
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        const expired =
          error.message.toLowerCase().includes("expired") ||
          error.message.toLowerCase().includes("invalid");
        setErrorMessage(
          expired
            ? "This setup link has expired (links are valid for 24 hours). Please contact the school office to request a new one."
            : `Authentication failed: ${error.message}`,
        );
        setStatus("error");
        return;
      }

      // Session is now live. Redirect to set-password page.
      // For recovery (invite) links always go to reset-password.
      if (type === "recovery") {
        router.replace("/auth/reset-password");
      } else {
        // Fallback for magic links, email confirmations, etc.
        router.replace("/dashboard");
      }
    }

    handleFragment();
  }, [router]);

  if (status === "error") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans">
        <div className="max-w-md w-full border border-red-200 rounded-2xl p-8 bg-white shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-7 w-7 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-red-700 mb-2">
            Link Unavailable
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            {errorMessage}
          </p>
          <p className="text-xs text-slate-400">
            Please contact the school office or ask your child's teacher to
            resend the invite.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Back to Login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 font-sans">
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full border-4 border-amber-100 border-t-amber-500"
          style={{ animation: "spin 0.8s linear infinite" }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p className="text-amber-800 font-semibold text-lg">
          Setting up your account…
        </p>
        <p className="text-amber-600 text-sm">
          You will be redirected to create your password shortly.
        </p>
      </div>
    </main>
  );
}
