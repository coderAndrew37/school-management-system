"use client";

// ─────────────────────────────────────────────────────────────────────────────
// components/nav/AdminSidebar.tsx
// Dark sidebar for the admin layout. Matches #0c0f1a design system.
// Desktop: always visible, fixed left. Mobile: slide-in overlay.
// ─────────────────────────────────────────────────────────────────────────────

import { usePathname } from "next/navigation";
import Link from "next/link";
import { X, GraduationCap } from "lucide-react";
import { NavLink } from "@/lib/constants";

interface AdminSidebarProps {
  links: NavLink[];
  isOpen: boolean;
  onClose: () => void;
}

export function AdminSidebar({ links, isOpen, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const groups = links.reduce<Record<string, NavLink[]>>((acc, link) => {
    const key = link.group ?? "Other";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(link);
    return acc;
  }, {});

  function isActive(href: string): boolean {
    if (href === "/admin/dashboard") return pathname === "/admin/dashboard";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* ── Mobile overlay backdrop ──────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/*
        ── Sidebar panel ─────────────────────────────────────────────────────────

        WHY we use a <style> tag for the translate instead of conditional classes:

        Tailwind's production build statically scans class strings. When classes
        are built with ternary expressions or array.join(), the scanner sees the
        raw source tokens — but "translate-x-0", "-translate-x-full", and
        "lg:translate-x-0" are often purged because the scanner can't always
        prove they're reachable. The result: sidebar is invisible in production
        but works in dev (where all classes are included).

        The fix: always apply both a base class and override via a scoped
        <style> tag so the rule is never subject to purging.
      */}
      <aside className="sidebar-panel fixed top-0 left-0 z-50 h-screen w-[240px] flex flex-col bg-[#0a0d16] border-r border-white/[0.06] transition-transform duration-300 ease-in-out">
        <style>{`
          /* Mobile: off-screen by default */
          .sidebar-panel {
            transform: translateX(-100%);
          }
          /* Mobile: open state */
          .sidebar-panel.sidebar-open {
            transform: translateX(0);
          }
          /* Desktop: always visible */
          @media (min-width: 1024px) {
            .sidebar-panel {
              transform: translateX(0) !important;
            }
          }
        `}</style>

        {/* Apply open class — this is a plain boolean, not a Tailwind purge risk */}
        <style>
          {isOpen ? ".sidebar-panel { transform: translateX(0); }" : ""}
        </style>

        {/* ── Logo ────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06] flex-shrink-0">
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2.5"
            onClick={onClose}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 border border-amber-400/25 flex-shrink-0">
              <GraduationCap className="h-4 w-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-400/70 leading-none">
                Kibali
              </p>
              <p className="text-xs font-bold text-white/70 leading-none mt-0.5">
                Academy
              </p>
            </div>
          </Link>

          <button
            onClick={onClose}
            className="lg:hidden flex h-7 w-7 items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Nav links ───────────────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5 no-scrollbar">
          {Object.entries(groups).map(([groupName, groupLinks]) => (
            <div key={groupName}>
              <p className="px-3 mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-white/20">
                {groupName}
              </p>

              <div className="space-y-0.5">
                {groupLinks.map((link) => {
                  const active = isActive(link.href);
                  const Icon = link.icon;

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={onClose}
                      className={
                        active
                          ? "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 bg-amber-400/12 border border-amber-400/20 text-amber-400"
                          : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 text-white/45 hover:text-white/80 hover:bg-white/[0.04] border border-transparent"
                      }
                    >
                      <div
                        className={
                          active
                            ? "flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition-colors bg-amber-400/15 text-amber-400"
                            : "flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg transition-colors text-white/30"
                        }
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <span className="truncate">{link.label}</span>

                      {active && (
                        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-white/[0.05]">
          <p className="text-[9px] text-white/15 font-mono text-center leading-relaxed">
            CBC School Management
            <br />
            Academic Year 2026
          </p>
        </div>
      </aside>
    </>
  );
}
