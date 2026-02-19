import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

/**
 * Server-side Supabase client using the anon key.
 * Uses cookies() from next/headers for PKCE session management.
 * Use this in Server Components, Server Actions, and Route Handlers.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env vars");
  }

  const cookieStore = await cookies();

  return createSSRServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // setAll is called from a Server Component — safe to ignore
        }
      },
    },
  });
}

/**
 * Service-role client — bypasses RLS.
 * Use ONLY in trusted server contexts (Server Actions, admin API routes).
 * NEVER expose the service role key to the client.
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  // Service client does not need cookie-based session management
  const { createClient } = require("@supabase/supabase-js");
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
