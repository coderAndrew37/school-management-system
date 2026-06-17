"use client";

import { type BaseRole } from "@/lib/types/auth";
import { useRouter } from "next/navigation";
import { AuthLayout } from "./AuthLayout";
import {
  PORTAL_META,
  PORTAL_BRAND_ICON,
  getDisplayablePortals,
  getPortalDestination,
} from "@/lib/auth/portal-meta";

interface Props {
  roles: BaseRole[];
  redirectTo?: string;
}

export function ChooseRoleForm({ roles, redirectTo }: Props) {
  const router = useRouter();

  // Filter to roles we actually have UI metadata for BEFORE any length checks,
  // so super_admin/student in the array can't cause an inconsistent count
  // vs. what middleware computed.
  const displayableRoles = getDisplayablePortals(roles);

  // If no roles are presentable, bounce to login safely.
  if (displayableRoles.length === 0) {
    router.replace("/login");
    return null;
  }

  // If only one presentable option exists, bypass the choice interface entirely.
  if (displayableRoles.length === 1) {
    const destination = redirectTo ?? getPortalDestination(displayableRoles[0]);
    router.replace(destination);
    return null;
  }

  const handleChoose = (role: BaseRole) => {
    const destination = redirectTo ?? getPortalDestination(role);
    router.push(destination);
  };

  return (
    <AuthLayout>
      {/* Header Context Banner */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 border border-amber-100">
          {PORTAL_BRAND_ICON}
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700/70">
            Kibali Academy
          </p>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Choose portal</h1>
        </div>
      </div>

      <p className="text-sm text-slate-500 mb-6">
        Your account has access to multiple portals. Where would you like to go?
      </p>

      {/* Select Portal Card Matrix */}
      <div className="space-y-3">
        {displayableRoles.map((role) => {
          const meta = PORTAL_META[role];
          if (!meta) return null;

          return (
            <button
              key={role}
              type="button"
              onClick={() => handleChoose(role)}
              className={[
                "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all text-left group",
                meta.bg,
                meta.accent,
              ].join(" ")}
            >
              <div className="shrink-0 p-2 bg-white rounded-lg shadow-sm border border-slate-100">
                {meta.icon}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-slate-800">{meta.label}</p>
                <p className="text-xs text-slate-400 group-hover:text-slate-500 transition-colors">
                  {meta.description}
                </p>
              </div>
              <span className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all font-bold pr-1">
                →
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400 text-center">
        You can switch portals any time from your account menu.
      </p>

      {/* Signature Branding Footer */}
      <div className="mt-12 pt-6 border-t border-slate-100 flex items-center justify-center">
        <p className="text-xs text-slate-400 font-medium tracking-wide">
          Built with precision by{" "}
          <span className="font-bold text-amber-600">SleekSites</span>
        </p>
      </div>
    </AuthLayout>
  );
}