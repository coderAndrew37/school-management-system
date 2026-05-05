"use client";

import type { Student } from "@/lib/types/dashboard";
import { ChevronDown, Download, Filter, Layers, Search, X } from "lucide-react";
import { exportToCSV } from "../utils";

interface ToolbarProps {
  search: string;
  setSearch: (value: string) => void;
  gradeFilter: string;
  setGradeFilter: (value: string) => void;
  streamFilter: string;
  setStreamFilter: (value: string) => void;
  genderFilter: string;
  setGenderFilter: (value: string) => void;
  uniqueGrades: string[];
  uniqueStreams: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  filteredStudents: Student[];           // Properly typed
  gradeFilterForExport: string;
}

export default function Toolbar({
  search,
  setSearch,
  gradeFilter,
  setGradeFilter,
  streamFilter,
  setStreamFilter,
  genderFilter,
  setGenderFilter,
  uniqueGrades,
  uniqueStreams,
  hasActiveFilters,
  onClearFilters,
  filteredStudents,
  gradeFilterForExport,
}: ToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, ID or parent…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40 transition-all"
          aria-label="Search students"
        />
      </div>

      {/* Grade Filter */}
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        <select
          aria-label="Grade Filter"
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 cursor-pointer transition-all"
        >
          <option value="">All Grades</option>
          {uniqueGrades.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
      </div>

      {/* Stream Filter */}
      <div className="relative">
        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        <select
          aria-label="Stream Filter"
          value={streamFilter}
          onChange={(e) => setStreamFilter(e.target.value)}
          className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 cursor-pointer transition-all"
        >
          <option value="">All Streams</option>
          {uniqueStreams.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
      </div>

      {/* Gender Filter */}
      <div className="relative">
        <select
          aria-label="Gender Filter"
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 cursor-pointer transition-all"
        >
          <option value="">All Genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/40 hover:text-white/70 transition-all"
        >
          <X className="h-3.5 w-3.5" /> Clear
        </button>
      )}

      {/* Export */}
      <button
        onClick={() => exportToCSV(filteredStudents, gradeFilterForExport || undefined)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white/50 hover:text-white transition-all"
        aria-label="Export to CSV"
      >
        <Download className="h-3.5 w-3.5" /> Export CSV
      </button>
    </div>
  );
}