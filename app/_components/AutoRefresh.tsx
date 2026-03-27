"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthRefreshHandler() {
  const router = useRouter();

  useEffect(() => {
    const checkMetadata = async () => {
      // Create client inside useEffect to ensure it stays on the client
      const supabase = await createSupabaseBrowserClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Trigger refresh if user exists but metadata is missing the role
      if (user && !user.app_metadata?.role) {
        console.log("Syncing Kibali Academy permissions...");

        const { error } = await supabase.auth.refreshSession();

        if (!error) {
          // router.refresh() tells Next.js to re-run Server Components
          // (like your AdminLayout) with the new session.
          router.refresh();
        }
      }
    };

    checkMetadata();
  }, [router]);

  return null;
}
