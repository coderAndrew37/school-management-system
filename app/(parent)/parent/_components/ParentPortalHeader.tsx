import { Bell } from "lucide-react";
import type { ChildWithAssessments } from "@/lib/types/parent";
import { getInitials } from "./parent.utils";

interface Props {
  firstName: string;
  children: ChildWithAssessments[];
  activeChildId: string;
  unreadCount: number;
}

export function ParentPortalHeader({
  firstName,
  children,
  activeChildId,
  unreadCount,
}: Props) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-400 font-semibold">Welcome back,</p>
          <p className="text-sm font-black text-slate-800 leading-none">
            {firstName}
          </p>
        </div>

        {children.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {children.map((child) => {
              const active = child.id === activeChildId;
              return (
                <a
                  key={child.id}
                  href={`/parent?child=${child.id}`}
                  className={[
                    "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap border transition-all shrink-0",
                    active
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200"
                      : "bg-white text-slate-500 border-slate-200 hover:border-blue-200 hover:text-blue-600",
                  ].join(" ")}
                >
                  <span
                    className={`h-5 w-5 rounded-md flex items-center justify-center text-[9px] font-black ${active ? "bg-white/20" : "bg-slate-100"}`}
                  >
                    {getInitials(child.full_name)}
                  </span>
                  {child.full_name.split(" ")[0]}
                </a>
              );
            })}
          </div>
        )}

        {unreadCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-1.5 shrink-0">
            <Bell className="h-3.5 w-3.5" />
            {unreadCount}
          </div>
        )}
      </div>
    </header>
  );
}