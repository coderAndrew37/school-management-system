// app/teacher/conduct/components/ConductLeaderboard.tsx
// Top-5 students by net conduct points for the term.
// Purely presentational — receives a pre-sorted entries array.

import { getInitials } from "../conduct.config";

export interface LeaderboardEntry {
  studentId: string;
  name: string;
  pts: number;
  grade: string;
  stream: string;
}

interface Props {
  entries: LeaderboardEntry[];
}

export function ConductLeaderboard({ entries }: Props) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500">
          Term Leaderboard
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {entries.map(({ studentId, name, pts, grade, stream }, i) => (
          <div key={studentId} className="flex items-center gap-3 px-5 py-3">
            <span className="text-sm font-black text-slate-300 w-5">
              {i + 1}
            </span>
            <div
              className={`h-8 w-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${pts >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
            >
              {getInitials(name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                {name}
              </p>
              <p className="text-[10px] text-slate-400">
                {stream === "Main" ? grade : `${grade} ${stream}`}
              </p>
            </div>
            <span
              className={`text-sm font-black ${pts >= 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {pts >= 0 ? "+" : ""}
              {pts}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
