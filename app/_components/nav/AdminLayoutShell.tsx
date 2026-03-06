"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/nav/AdminLayoutShell.tsx
// Client wrapper that manages sidebar open/close state for the admin layout.
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
      <AdminSidebar
        links={ADMIN_LINKS}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/*
        Main content area.

        WHY inline style instead of lg:pl-[240px]:
        Tailwind's JIT scanner statically analyses class strings. Arbitrary
        values like lg:pl-[240px] are frequently dropped by the production
        build (PurgeCSS / content scanning) even when written as a plain
        string, because the scanner doesn't always resolve them in .tsx files.
        Using an inline style is 100% reliable and has zero runtime cost.

        The responsive override (padding = 0 on mobile) is handled by the
        media query in the <style> tag below. This is the only safe pattern
        when you can't add the class to Tailwind's safelist.
      */}
      <div className="admin-shell flex flex-col min-h-screen">
        <style>{`
          .admin-shell {
            padding-left: 240px;
          }
          @media (max-width: 1023px) {
            .admin-shell {
              padding-left: 0;
            }
          }
        `}</style>

        <TopNav
          profile={profile}
          email={email}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
