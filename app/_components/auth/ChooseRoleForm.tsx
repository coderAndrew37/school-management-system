"use client";

import { ROLE_ROUTES, type UserRole } from "@/lib/types/auth";
import { GraduationCap, ShieldCheck, BookOpen, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "./AuthLayout";

const ROLE_META: Record<UserRole, {
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  bg: string;
}> = {
  admin: {
    label: "Administrator",
    description: "School management & reports",
    icon: <ShieldCheck className="h-5 w-5" />,
    accent: "border-amber-300 text-amber-700",
    bg: "bg-amber-50 hover:bg-amber-100/60",
  },
  teacher: {
    label: "Teacher",
    description: "CBC assessments & timetable",
    icon: <BookOpen className="h-5 w-5" />,
    accent: "border-emerald-300 text-emerald-700",
    bg: "bg-emerald-50 hover:bg-emerald-100/60",
  },
  parent: {
    label: "Parent / Guardian",
    description: "Child results & communication",
    icon: <Users className="h-5 w-5" />,
    accent: "border-sky-300 text-sky-700",
    bg: "bg-sky-50 hover:bg-sky-100/60",
  },
  
};

interface Props {
  roles: UserRole[];
  redirectTo?: string;
}

export function ChooseRoleForm({ roles, redirectTo }: Props) {
  const router = useRouter();

  // Fallback: if no roles passed (direct URL access), send to login
  if (roles.length === 0) {
    router.replace("/login");
    return null;
  }

  // If somehow only one role, skip the picker entirely
  if (roles.length === 1) {
    router.replace(redirectTo ?? ROLE_ROUTES[roles[0]]);
    return null;
  }

  const handleChoose = (role: UserRole) => {
    router.push(redirectTo ?? ROLE_ROUTES[role]);
  };

  return (
    <AuthLayout>
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 border border-amber-100">
          <GraduationCap className="h-5 w-5 text-amber-700" />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700/70">
            Kibali Academy
          </p>
          <h1 className="text-lg font-semibold text-slate-900 leading-tight">
            Choose portal
          </h1>
        </div>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        Your account has access to multiple portals. Where would you like to go?
      </p>

      <div className="space-y-3">
        {roles.map((role) => {
          const meta = ROLE_META[role];
          return (
            <button
              key={role}
              type="button"
              onClick={() => handleChoose(role)}
              className={[
                "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all",
                meta.bg,
                meta.accent,
              ].join(" ")}
            >
              <span className="shrink-0">{meta.icon}</span>
              <div>
                <p className="font-semibold text-sm">{meta.label}</p>
                <p className="text-xs text-slate-400">{meta.description}</p>
              </div>
              <span className="ml-auto text-slate-300">→</span>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400 text-center">
        You can switch portals any time from your account menu.
      </p>
    </AuthLayout>
  );
}