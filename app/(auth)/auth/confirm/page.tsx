"use client";

/**
 * /app/auth/confirm/page.tsx
 *
 * Admin-generated Supabase links deliver tokens in the URL fragment (#access_token=...).
 * The browser client does NOT auto-parse fragments after initial load, so we must
 * manually extract the tokens and call setSession() ourselves.
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
      // 1. Read and parse the URL fragment
      const hash = window.location.hash.slice(1); // strip leading #
      if (!hash) {
        setErrorMessage(
          "No authentication tokens found in this link. It may be malformed.",
        );
        setStatus("error");
        return;
      }

      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const type = params.get("type"); // 'recovery' for password setup links

      if (!accessToken || !refreshToken) {
        setErrorMessage(
          "This link is missing required tokens. Please request a new invite.",
        );
        setStatus("error");
        return;
      }

      // 2. Manually establish the session with the tokens from the fragment
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error("setSession error:", error.message);
        setErrorMessage(
          error.message.includes("expired")
            ? "This setup link has expired. Please contact the school to request a new one."
            : `Authentication failed: ${error.message}`,
        );
        setStatus("error");
        return;
      }

      // 3. Session is live — redirect based on link type
      if (type === "recovery") {
        // Password setup / reset flow
        router.replace("/auth/reset-password");
      } else {
        // Fallback for any other type (signup confirmation, magic link, etc.)
        router.replace("/dashboard");
      }
    }

    handleFragment();
  }, [router]);

  // ── UI ────────────────────────────────────────────────────────────────────

  if (status === "error") {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            border: "1px solid #fca5a5",
            borderRadius: 12,
            padding: 32,
            background: "#fff1f2",
          }}
        >
          <h2 style={{ color: "#b91c1c", marginTop: 0 }}>Link Unavailable</h2>
          <p style={{ color: "#7f1d1d", lineHeight: 1.6 }}>{errorMessage}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        gap: 16,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "4px solid #fef3c7",
          borderTop: "4px solid #f59e0b",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: "#92400e", fontWeight: 600 }}>
        Setting up your account…
      </p>
      <p style={{ color: "#b45309", fontSize: 14 }}>
        You will be redirected shortly.
      </p>
    </main>
  );
}
