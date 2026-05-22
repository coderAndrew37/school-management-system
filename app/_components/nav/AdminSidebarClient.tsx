"use client";

// components/nav/AdminSidebarClient.tsx
// Kibali Academy — Presentational Sidebar (Client Component)
//
// Receives only the pre-filtered, authorized NavLink array from the server.
// Handles collapse state, mobile drawer, and Framer Motion animations.
// Never performs any permission checks — that's done server-side.

import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, GraduationCap, ChevronLeft, ChevronRight } from "lucide-react";
import type { NavLink } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminSidebarClientProps {
  links: NavLink[];
  isOpen: boolean;
  onClose: () => void;
  // Optional: allow the parent shell to control collapse state
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminSidebarClient({
  links,
  isOpen,
  onClose,
  isCollapsed: externalCollapsed,
  onToggleCollapse,
}: AdminSidebarClientProps) {
  const pathname = usePathname();

  // Internal collapse state — used when the parent shell doesn't manage it
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "true";
  });

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "sidebar-collapsed") {
        setInternalCollapsed(e.newValue === "true");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Prefer externally-controlled state, fall back to internal
  const isCollapsed = externalCollapsed ?? internalCollapsed;

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
      return;
    }
    const next = !internalCollapsed;
    setInternalCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  // Group links by their `group` label, preserving insertion order
  const groups = links.reduce<Record<string, NavLink[]>>((acc, link) => {
    const key = link.group ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(link);
    return acc;
  }, {});

  const isActive = (href: string): boolean => {
    if (href === "/admin/dashboard") return pathname === "/admin/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* ── Mobile Backdrop ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={[
          "fixed top-0 left-0 z-50 h-screen flex flex-col",
          "bg-[#0a0d16] border-r border-white/[0.06]",
          "transition-all duration-300 ease-out overflow-hidden",
          // Desktop: always visible, width driven by collapse state
          "hidden lg:flex",
          isCollapsed ? "w-[76px]" : "w-[260px]",
          // Mobile: drawer — translate based on isOpen
          "max-lg:fixed max-lg:flex",
          isOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full",
          "max-lg:w-[260px]",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-white/[0.06] flex-shrink-0">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 min-w-0"
            onClick={onClose}
          >
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
              <GraduationCap className="h-4.5 w-4.5 text-white" />
            </div>

            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.div
                  key="wordmark"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="min-w-0"
                >
                  <p className="text-lg font-black tracking-tighter text-white leading-none">
                    Kibali
                  </p>
                  <p className="text-[10px] text-amber-400/70 -mt-0.5 tracking-widest">
                    ACADEMY
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </Link>

          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Collapse toggle — desktop only */}
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex h-8 w-8 items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>

            {/* Close button — mobile only */}
            <button
              onClick={onClose}
              className="lg:hidden h-8 w-8 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.05] rounded-xl"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Navigation ──────────────────────────────────────────────────── */}
        <nav
          className="flex-1 overflow-y-auto py-6 px-3 no-scrollbar"
          aria-label="Main navigation"
        >
          {Object.entries(groups).map(([groupName, groupLinks]) => (
            <div key={groupName} className="mb-7">
              {/* Group label */}
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.p
                    key={`label-${groupName}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/25 select-none"
                  >
                    {groupName}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Group links */}
              <div className="space-y-0.5" role="list">
                {groupLinks.map((link) => {
                  const active = isActive(link.href);
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onClose}
                      role="listitem"
                      title={isCollapsed ? link.label : undefined}
                      className={[
                        "group flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium",
                        "transition-all duration-150 relative overflow-hidden",
                        active
                          ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                          : "text-white/55 hover:text-white hover:bg-white/[0.04] border border-transparent",
                      ].join(" ")}
                      aria-current={active ? "page" : undefined}
                    >
                      {/* Icon container */}
                      <div
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0 transition-all",
                          active
                            ? "bg-amber-400/15"
                            : "group-hover:bg-white/[0.05]",
                        ].join(" ")}
                      >
                        <Icon
                          className={[
                            "h-[18px] w-[18px] transition-colors",
                            active ? "text-amber-400" : "",
                          ].join(" ")}
                          aria-hidden="true"
                        />
                      </div>

                      {/* Label — hidden when collapsed */}
                      <AnimatePresence mode="wait">
                        {!isCollapsed && (
                          <motion.span
                            key={`lbl-${link.href}`}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            transition={{ duration: 0.15 }}
                            className="truncate flex-1 min-w-0"
                          >
                            {link.label}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {/* Active indicator dot */}
                      {active && !isCollapsed && (
                        <motion.div
                          layoutId="activePill"
                          className="absolute right-4 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"
                          transition={{ type: "spring", stiffness: 380, damping: 35 }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 p-4 border-t border-white/[0.06]">
          <AnimatePresence mode="wait">
            {!isCollapsed ? (
              <motion.div
                key="footer-expanded"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="text-center"
              >
                <p className="text-[10px] text-white/20 font-mono tabular-nums">
                  Academic Year 2026
                </p>
                <p className="text-[10px] text-white/15 mt-0.5">CBC · Kenya</p>
              </motion.div>
            ) : (
              <motion.div
                key="footer-collapsed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center"
              >
                <span className="text-amber-400/25 text-lg" aria-hidden="true">
                  🎓
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>
    </>
  );
}