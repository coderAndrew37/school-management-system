"use client";

// components/nav/AdminLayoutShell.tsx
// Kibali Academy — Admin Layout Shell (Client Component)
//
// Manages sidebar open/collapse state for the entire admin layout.
// Receives the pre-authorized NavLink array from the server layout —
// never performs permission checks itself.
//
// The effectivePermissions prop is available to child pages via context
// if needed for fine-grained UI element toggling (button disablement, etc.)

import { useState, createContext, useContext, type ReactNode } from "react";
import type { NavLink } from "@/lib/constants";
import type { Profile } from "@/lib/types/auth";
import { AdminSidebarClient } from "./AdminSidebarClient";
import { TopNav } from "./TopNav";

// ── Permission Context ────────────────────────────────────────────────────────
// Exposes the profile and derived helpers to any client child component
// without prop-drilling. Consumed by useAdminPermissions() hook.

interface AdminPermissionsContextValue {
  profile: Profile;
  isSuperAdmin: boolean;
  isDev: boolean;
}

const AdminPermissionsContext = createContext<AdminPermissionsContextValue | null>(
  null
);

export function useAdminPermissions(): AdminPermissionsContextValue {
  const ctx = useContext(AdminPermissionsContext);
  if (!ctx) {
    throw new Error(
      "useAdminPermissions must be used inside AdminLayoutShell"
    );
  }
  return ctx;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AdminLayoutShellProps {
  profile: Profile;
  email: string;
  /** Pre-filtered authorized links from the server layout */
  authorizedLinks: NavLink[];
  children: ReactNode;
}

// ── Shell ─────────────────────────────────────────────────────────────────────

export function AdminLayoutShell({
  profile,
  email,
  authorizedLinks,
  children,
}: AdminLayoutShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  const contextValue: AdminPermissionsContextValue = {
    profile,
    isSuperAdmin: profile.is_super_admin || profile.is_dev,
    isDev: profile.is_dev,
  };

  // Sidebar width values kept in sync with AdminSidebarClient dimensions
  const sidebarWidth = isCollapsed ? "76px" : "260px";

  return (
    <AdminPermissionsContext.Provider value={contextValue}>
      <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">

        {/* Sidebar — receives only the pre-authorized link array */}
        <AdminSidebarClient
          links={authorizedLinks}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />

        {/* Main content column */}
        <div
          className="flex flex-col min-h-screen transition-[padding] duration-300 ease-out"
          style={{
            // Desktop: offset by sidebar width. Mobile: no offset.
            // Using inline style so the value is reactive to isCollapsed state.
            paddingLeft: `clamp(0px, calc(100vw - 1024px + ${sidebarWidth}), ${sidebarWidth})`,
          }}
        >
          <TopNav
            profile={profile}
            email={email}
            onMenuClick={() => setSidebarOpen(true)}
          />

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </AdminPermissionsContext.Provider>
  );
}