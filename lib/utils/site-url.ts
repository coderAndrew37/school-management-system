// lib/utils/site-url.ts
// Single source of truth for the canonical site URL.
//
// Priority order:
//   1. NEXT_PUBLIC_SITE_URL env var (set this in Vercel dashboard)
//   2. VERCEL_URL env var (auto-set by Vercel on every deployment)
//   3. Fallback to localhost for local dev only
//
// NEVER returns localhost in production — if both env vars are missing on
// Vercel something is misconfigured and this will throw clearly.

export function getSiteUrl(): string {
  // Explicitly configured — always wins
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    const url = process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/$/, "");
    // Ensure it has a protocol
    return url.startsWith("http") ? url : `https://${url}`;
  }

  // Vercel auto-injects this on every deployment (preview + production)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Local dev only
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  // Production with no URL configured — fail loudly so it's caught immediately
  throw new Error(
    "NEXT_PUBLIC_SITE_URL is not set. " +
      "Add it to your Vercel environment variables: " +
      "Settings → Environment Variables → NEXT_PUBLIC_SITE_URL = https://sleeksites-test.co.ke",
  );
}

/** Returns the /auth/confirm callback URL for this deployment. */
export function getAuthConfirmUrl(): string {
  return `${getSiteUrl()}/auth/confirm`;
}
