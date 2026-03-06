import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import type { Profile } from "@/lib/types/auth";

interface TopNavProps {
  profile: Profile;
  email: string;
  /** When provided, a hamburger is rendered (sidebar layout). */
  onMenuClick?: React.ComponentProps<"button">["onClick"];
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  teacher: "Teacher",
  parent: "Parent / Guardian",
};

// Full class strings — no string concatenation so Tailwind can scan them
const ROLE_COLORS: Record<string, string> = {
  admin: "bg-amber-400/10 text-amber-400 border-amber-400/25",
  teacher: "bg-emerald-400/10 text-emerald-400 border-emerald-400/25",
  parent: "bg-sky-400/10 text-sky-400 border-sky-400/25",
};

const AVATAR_COLORS: Record<string, string> = {
  admin: "bg-amber-400/15 border-amber-400/20 text-amber-400",
  teacher: "bg-emerald-400/15 border-emerald-400/20 text-emerald-400",
  parent: "bg-sky-400/15 border-sky-400/20 text-sky-400",
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

export function TopNav({ profile, email, onMenuClick }: TopNavProps) {
  const initials = getInitials(profile.full_name, email);
  const roleLabel = ROLE_LABELS[profile.role] ?? profile.role;
  const roleColor = ROLE_COLORS[profile.role] ?? ROLE_COLORS["parent"]!;
  const avatarColor = AVATAR_COLORS[profile.role] ?? AVATAR_COLORS["parent"]!;

  return (
    <nav className="sticky top-0 z-40 w-full h-14 border-b border-white/[0.06] bg-[#0c0f1a]/80 backdrop-blur-xl flex items-center">
      <div className="w-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* ── Left: hamburger (mobile) or standalone logo ───────────────────── */}
        <div className="flex items-center gap-3">
          {onMenuClick ? (
            <button
              onClick={onMenuClick}
              className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-white/40 hover:text-white hover:bg-white/[0.07] transition-all"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : (
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 border border-amber-400/25">
                <span className="text-xs font-bold text-amber-400">KA</span>
              </div>
              <span className="text-sm font-bold text-white/80 hidden sm:block">
                Kibali Academy
              </span>
            </Link>
          )}
        </div>

        {/* ── Right: role badge + avatar + logout ───────────────────────────── */}
        <div className="flex items-center gap-3">
          {/* Role badge — full class string per role so Tailwind never purges */}
          <span
            className={`hidden md:inline-flex items-center rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${roleColor}`}
          >
            {roleLabel}
          </span>

          {/* Avatar + name */}
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold flex-shrink-0 ${avatarColor}`}
            >
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

          {/* Sign out */}
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
