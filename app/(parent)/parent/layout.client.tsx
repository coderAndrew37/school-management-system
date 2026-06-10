"use client";

import Link from "next/link";
import { useTransition } from "react";
import {
  BookOpen,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Image,
  Wallet,
  Compass,
  School,
  Bell,
  CalendarDays,
  FileText,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";

const NAV_ITEMS = [
  { label: "Overview", href: "/parent/dashboard", icon: LayoutDashboard },
  { label: "Notices", href: "/parent/announcements", icon: Bell },
  { label: "Events", href: "/parent/events", icon: CalendarDays },
  { label: "Diary", href: "/parent/diary", icon: BookOpen },
  { label: "Attendance", href: "/parent/attendance", icon: CalendarCheck },
  { label: "Messages", href: "/parent/messages", icon: MessageSquare },
  { label: "Gallery", href: "/parent/gallery", icon: Image },
  { label: "Academics", href: "/parent/academics", icon: GraduationCap },
  { label: "Reports", href: "/parent/reports", icon: FileText },
  { label: "Fees", href: "/parent/fees", icon: Wallet },
  { label: "Pathway", href: "/parent/pathway", icon: Compass },
];

const BOTTOM_NAV = [
  { label: "Home", href: "/parent", icon: LayoutDashboard },
  { label: "Notices", href: "/parent/announcements", icon: Bell },
  { label: "Diary", href: "/parent/diary", icon: BookOpen },
  { label: "Messages", href: "/parent/messages", icon: MessageSquare },
  { label: "Reports", href: "/parent/reports", icon: FileText },
];

interface ClientShellProps {
  children: React.ReactNode;
  pathname: string;
}

export function ParentClientShell({ children, pathname }: ClientShellProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <div className="min-h-screen bg-[#f5f6fa] flex">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-white border-r border-slate-200 fixed top-0 left-0 h-screen z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
          <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
            <School className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-black text-sm text-slate-800 leading-none">
              Kibali
            </p>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide">
              Parent Portal
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const exact = href === "/parent";
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group",
                  active
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-800",
                ].join(" ")}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    active ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                  }`}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Sign Out Button */}
        <div className="px-3 py-2 border-t border-slate-100">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50/60 transition-all group disabled:opacity-50 text-left"
          >
            <LogOut className="h-4 w-4 shrink-0 text-rose-400 group-hover:text-rose-600" />
            <span>{isPending ? "Signing out..." : "Sign Out"}</span>
          </button>
        </div>

        <div className="px-5 py-3 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 font-medium">
            Kibali Academy · Parent Portal
          </p>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen lg:pl-60 pb-16 lg:pb-0">
        {/* Mobile Top Bar */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <School className="h-5 w-5 text-blue-600" />
            <span className="font-bold text-sm text-slate-800">Kibali Portal</span>
          </div>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSignOut}
            className="flex items-center justify-center p-2 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>

      {/* ── Bottom nav (mobile) ───────────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex">
        {BOTTOM_NAV.map(({ label, href, icon: Icon }) => {
          const exact = href === "/parent";
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-bold transition-colors ${
                active ? "text-blue-600" : "text-slate-400"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${active ? "text-blue-600" : "text-slate-400"}`}
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}