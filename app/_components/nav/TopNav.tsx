import { logoutAction } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types/auth";
import { LogOut } from "lucide-react";
import Link from "next/link";

interface TopNavProps {
  profile: Profile;
  email: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  parent: "Parent / Guardian",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-amber-400/10 text-amber-400 border-amber-400/25",
  teacher: "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
  parent: "bg-sky-400/10 text-sky-400 border-sky-400/25",
};

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}

export function TopNav({ profile, email }: TopNavProps) {
  const initials = getInitials(profile.full_name, email);
  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;
  const roleColor = ROLE_COLORS[profile.role] ?? ROLE_COLORS.parent;

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#0c0f1a]/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 border border-amber-400/25">
            <span className="text-xs font-bold text-amber-400">KA</span>
          </div>
          <span className="text-sm font-bold text-white/80 hidden sm:block">
            Kibali Academy
          </span>
        </Link>

        {/* Right: user info + logout */}
        <div className="flex items-center gap-3">
          {/* Role badge */}
          <span
            className={`hidden md:inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${roleColor}`}
          >
            {roleLabel}
          </span>

          {/* Avatar + name */}
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/15 border border-amber-400/20 text-xs font-bold text-amber-400 flex-shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-xs font-semibold text-white/80 truncate max-w-[120px]">
                {profile.full_name ?? email}
              </p>
              <p className="text-[10px] text-white/30 truncate max-w-[120px]">
                {email}
              </p>
            </div>
          </div>

          {/* Logout */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400 px-3 py-2 text-xs font-medium text-white/40 transition-all duration-200"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
