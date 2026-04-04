import type { TeacherStatus } from "@/lib/types/dashboard";

export const AVATAR_COLORS = [
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-400",
  "from-rose-400 to-pink-500",
];

export const STATUS_STYLE: Record<TeacherStatus, string> = {
  active: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  on_leave: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  resigned: "bg-slate-400/10 text-slate-400 border-slate-400/20",
  terminated: "bg-rose-400/10 text-rose-400 border-rose-400/20",
};

export const STATUS_LABEL: Record<TeacherStatus, string> = {
  active: "Active",
  on_leave: "On Leave",
  resigned: "Resigned",
  terminated: "Terminated",
};
