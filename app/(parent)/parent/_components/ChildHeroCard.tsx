import { CheckCircle2, GraduationCap, XCircle } from "lucide-react";
import type { ChildWithAssessments } from "@/lib/types/parent";
import { calcAge, getInitials } from "./parent.utils";
import { ATT_CONFIG } from "./parent.config";

interface AttendanceStats {
  presentCount: number;
  absentCount: number;
  attendRate: number | null;
}

interface Props {
  child: ChildWithAssessments;
  todayAttendanceStatus: string | null;
  stats: AttendanceStats;
}

export function ChildHeroCard({ child, todayAttendanceStatus, stats }: Props) {
  const todayConfig =
    todayAttendanceStatus ? ATT_CONFIG[todayAttendanceStatus] ?? null : null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 p-6 text-white shadow-lg shadow-blue-200/50">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-white/[0.07]" />
      <div className="pointer-events-none absolute right-16 -bottom-10 h-28 w-28 rounded-full bg-white/[0.04]" />

      <div className="relative flex items-center gap-5 flex-wrap">
        {/* Avatar */}
        <div className="h-16 w-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-black shrink-0 backdrop-blur-sm">
          {getInitials(child.full_name)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-xl tracking-tight">{child.full_name}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs font-semibold text-blue-200">
              <GraduationCap className="h-3.5 w-3.5" />
              {child.current_grade}
            </span>
            <span className="text-xs text-blue-200 font-semibold">
              Age {calcAge(child.date_of_birth)}
            </span>
            {child.readable_id && (
              <span className="font-mono text-xs font-bold text-amber-300 bg-white/10 px-2 py-0.5 rounded-lg">
                #{child.readable_id}
              </span>
            )}
          </div>

          {todayConfig && (
            <div className="mt-3 inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-xl px-3 py-1.5">
              <span className="text-sm">{todayConfig.icon}</span>
              <span className="text-xs font-bold text-white/90">
                {todayConfig.text}
              </span>
            </div>
          )}
        </div>

        {/* Attendance pill */}
        {stats.attendRate !== null && (
          <div className="text-center bg-white/10 border border-white/20 rounded-2xl px-5 py-3 backdrop-blur-sm">
            <p className="text-3xl font-black tabular-nums">
              {stats.attendRate}%
            </p>
            <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200 mt-0.5">
              Attendance
            </p>
            <div className="flex items-center justify-center gap-3 mt-1.5">
              <span className="flex items-center gap-1 text-[10px] text-white/70">
                <CheckCircle2 className="h-3 w-3 text-emerald-300" />{" "}
                {stats.presentCount}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-white/70">
                <XCircle className="h-3 w-3 text-rose-300" />{" "}
                {stats.absentCount}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}