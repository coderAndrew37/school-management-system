"use client";

// app/_components/nav/TeacherLayoutShell.tsx
// Client wrapper that manages sidebar open/close state for the teacher layout.
// Mirrors AdminLayoutShell but for the light teacher design system.

import { useState } from "react";
import type { Profile } from "@/lib/types/auth";
import { TeacherSidebar } from "./TeacherSidebar";
import { TopNav } from "@/app/_components/nav/TopNav";

interface Props {
  profile: Profile;
  email: string;
  children: React.ReactNode;
}

export function TeacherLayoutShell({ profile, email, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8F7F2] font-[family-name:var(--font-body)]">
      <TeacherSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/*
        Same inline style pattern as AdminLayoutShell — avoids Tailwind
        production purge of arbitrary lg:pl-[220px] values.
      */}
      <div className="teacher-shell flex flex-col min-h-screen">
        <style>{`
          .teacher-shell {
            padding-left: 220px;
          }
          @media (max-width: 1023px) {
            .teacher-shell {
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
