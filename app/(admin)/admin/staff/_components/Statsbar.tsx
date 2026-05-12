"use client";

// @/app/admin/staff/_components/StatsBar.tsx

import { Users, ShieldCheck, GraduationCap, Headphones } from "lucide-react";
import type { RoleStatistics } from "@/lib/types/auth";

export function StatsBar({ stats }: { stats: RoleStatistics }) {
  const cards = [
    { label: "Total Staff",      value: stats.total,                    icon: <Users           className="h-4 w-4" />, accent: "text-stone-600",  bg: "bg-stone-50",   border: "border-stone-100"  },
    { label: "Administrators",   value: stats.byBaseRole.admin   ?? 0,  icon: <ShieldCheck     className="h-4 w-4" />, accent: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-100"  },
    { label: "Teachers",         value: stats.byBaseRole.teacher ?? 0,  icon: <GraduationCap   className="h-4 w-4" />, accent: "text-sky-700",    bg: "bg-sky-50",     border: "border-sky-100"    },
    { label: "Support Staff",    value: stats.byBaseRole.support ?? 0,  icon: <Headphones      className="h-4 w-4" />, accent: "text-teal-700",   bg: "bg-teal-50",    border: "border-teal-100"   },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(({ label, value, icon, accent, bg, border }) => (
        <div key={label} className={`flex items-center gap-3.5 rounded-2xl border ${border} bg-white px-5 py-4`}>
          <div className={`rounded-xl ${bg} ${accent} p-2.5`}>{icon}</div>
          <div>
            <p className="text-2xl font-bold leading-none text-stone-900">{value}</p>
            <p className="mt-1 text-xs text-stone-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}