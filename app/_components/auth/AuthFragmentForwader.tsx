"use client";

// app/_components/auth/AuthFragmentForwarder.tsx
//
// Supabase sometimes delivers auth tokens to the Site URL (e.g. /login)
// instead of /auth/confirm when the redirectTo URL isn't in the allowed list.
// This component detects an access_token fragment on any page and immediately
// forwards the user to /auth/confirm with the full hash preserved, so the
// confirm page can establish the session correctly.
//
// Mount this in the login page layout — it renders nothing visible.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AuthFragmentForwarder() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get("access_token");
    const type = params.get("type");

    // Only forward if this looks like an auth callback token
    if (!accessToken) return;

    // Preserve the full fragment so /auth/confirm can read it
    router.replace(`/auth/confirm${hash}`);
  }, [router]);

  return null;
}
