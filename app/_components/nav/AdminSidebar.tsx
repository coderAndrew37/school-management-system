// components/nav/AdminSidebar.tsx
// Kibali Academy — Server Component Sidebar
//
// This component runs exclusively on the server during layout render.
// It resolves the active session, evaluates the full domain-action permission
// pipeline, filters the ADMIN_LINKS manifest, and hands the authorized subset
// to the presentational AdminSidebarClient component.
//
// No unauthorized route strings ever reach the browser.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthorizedLinks } from "@/lib/constants";
import type { Profile } from "@/lib/types/auth";
import { AdminSidebarClient } from "./AdminSidebarClient";

// ── Props ─────────────────────────────────────────────────────────────────────
// The layout passes the already-resolved profile so this component doesn't
// need an extra round-trip — it just runs the filter and renders.

interface AdminSidebarProps {
  profile: Profile;
  isOpen: boolean;
  onClose: () => void;
}

// ── Server Component ──────────────────────────────────────────────────────────

export async function AdminSidebar({
  profile,
  isOpen,
  onClose,
}: AdminSidebarProps) {
  // Filter links through the domain-action pipeline (runs server-side only)
  const authorizedLinks = getAuthorizedLinks(profile);

  return (
    <AdminSidebarClient
      links={authorizedLinks}
      isOpen={isOpen}
      onClose={onClose}
    />
  );
}