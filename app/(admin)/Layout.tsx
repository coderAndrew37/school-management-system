"use client";
import { useState } from "react";

import Navbar from "../_components/shared/Navbar";
import Sidebar from "../_components/shared/Sidebar";
import { ADMIN_LINKS } from "@/lib/constants";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        links={ADMIN_LINKS}
        isOpen={isSidebarOpen}
        setIsOpen={setSidebarOpen}
      />

      <div className="lg:ml-[260px]">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
