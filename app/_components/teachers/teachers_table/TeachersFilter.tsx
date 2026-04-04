"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import type { TeacherStatus } from "@/lib/types/dashboard";

interface TeachersFilterProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  statusFilter: TeacherStatus | "all";
  onStatusChange: (val: TeacherStatus | "all") => void;
}

export function TeachersFilter({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
}: TeachersFilterProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/[0.02] border border-white/[0.06] p-4 rounded-2xl">
      {/* Search Input */}
      <div className="relative w-full md:max-w-sm">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name, email or TSC..."
          className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-amber-400/50 transition-all"
        />
      </div>

      {/* Status Filter Dropdown */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className="flex items-center gap-2 text-white/40 text-xs font-semibold uppercase tracking-wider">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filter:</span>
        </div>
        <select
          name="status"
          id="status"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as any)}
          className="bg-white/[0.05] border border-white/10 rounded-xl py-2 px-4 text-sm text-white outline-none focus:border-amber-400/50 cursor-pointer appearance-none"
        >
          <option value="all" className="bg-[#0f1220]">
            All Statuses
          </option>
          <option value="active" className="bg-[#0f1220]">
            Active Only
          </option>
          <option value="on_leave" className="bg-[#0f1220]">
            On Leave
          </option>
          <option value="resigned" className="bg-[#0f1220]">
            Resigned
          </option>
          <option value="terminated" className="bg-[#0f1220]">
            Terminated
          </option>
        </select>
      </div>
    </div>
  );
}
