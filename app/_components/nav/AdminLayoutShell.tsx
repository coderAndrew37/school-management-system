"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/nav/AdminLayoutShell.tsx
// Client wrapper that manages sidebar open/close state for the admin layout.
// The actual (admin)/layout.tsx is a Server Component — it passes session data
// down to this shell which renders the sidebar + nav + children.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

import type { Profile } from "@/lib/types/auth";
import { ADMIN_LINKS } from "@/lib/constants";
import { AdminSidebar } from "./AdminSidebar";
import { TopNav } from "./TopNav";

interface AdminLayoutShellProps {
  profile: Profile;
  email: string;
  children: React.ReactNode;
}

export function AdminLayoutShell({
  profile,
  email,
  children,
}: AdminLayoutShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Sidebar */}
      <AdminSidebar
        links={ADMIN_LINKS}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main area — offset by sidebar width on desktop */}
      <div className="lg:pl-[240px] flex flex-col min-h-screen">
        {/* Top nav */}
        <TopNav
          profile={profile}
          email={email}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Page content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
