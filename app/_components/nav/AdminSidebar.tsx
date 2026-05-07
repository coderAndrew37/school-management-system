"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, GraduationCap, ChevronLeft, ChevronRight } from "lucide-react";
import { NavLink } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface AdminSidebarProps {
  links: NavLink[];
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ links, isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  // ✅ Fixed: Use lazy initializer to avoid setState in useEffect
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  // Optional: Sync with localStorage if it changes from another tab
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sidebar-collapsed") {
        setIsCollapsed(e.newValue === "true");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("sidebar-collapsed", String(newState));
  };

  const groups = links.reduce<Record<string, NavLink[]>>((acc, link) => {
    const key = link.group ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(link);
    return acc;
  }, {});

  const isActive = (href: string) => {
    if (href === "/admin/dashboard") return pathname === "/admin/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen flex flex-col bg-[#0a0d16] border-r border-white/[0.06] transition-all duration-300 ease-out overflow-hidden
          ${isCollapsed ? "w-[76px]" : "w-[260px]"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06] flex-shrink-0">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3"
            onClick={onClose}
          >
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>

            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="min-w-0"
                >
                  <p className="text-lg font-black tracking-tighter text-white">Kibali</p>
                  <p className="text-[10px] text-amber-400/70 -mt-1">ACADEMY</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>

          <div className="flex items-center gap-1">
            {/* Collapse Button - Desktop only */}
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex h-8 w-8 items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all"
              aria-label="Toggle sidebar width"
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>

            {/* Close Button - Mobile only */}
            <button
              onClick={onClose}
              className="lg:hidden h-8 w-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 rounded-xl"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-3 no-scrollbar">
          {Object.entries(groups).map(([groupName, groupLinks]) => (
            <div key={groupName} className="mb-8">
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30"
                  >
                    {groupName}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="space-y-1">
                {groupLinks.map((link) => {
                  const active = isActive(link.href);
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onClose}
                      className={`group flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-medium transition-all duration-200 relative overflow-hidden
                        ${active
                          ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                          : "text-white/60 hover:text-white hover:bg-white/[0.03]"
                        }`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all
                          ${active ? "bg-amber-400/15" : "group-hover:bg-white/5"}`}
                      >
                        <Icon className={`h-4.5 w-4.5 transition-colors ${active ? "text-amber-400" : ""}`} />
                      </div>

                      <AnimatePresence mode="wait">
                        {!isCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className="truncate"
                          >
                            {link.label}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {active && !isCollapsed && (
                        <motion.div
                          layoutId="activePill"
                          className="absolute right-4 w-1.5 h-1.5 rounded-full bg-amber-400"
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 p-5 border-t border-white/[0.06]">
          <AnimatePresence mode="wait">
            {!isCollapsed ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-[10px] text-white/20 font-mono">Academic Year 2026</p>
                <p className="text-[10px] text-white/20 mt-0.5">CBC • Kenya</p>
              </motion.div>
            ) : (
              <div className="flex justify-center">
                <div className="text-amber-400/30 text-xl">🎓</div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </aside>
    </>
  );
}