// StudentsTableClient/_components/FilterSummary.tsx
"use client";

import { GraduationCap, Printer } from "lucide-react";

interface FilterSummaryProps {
  gradeFilter: string;
  streamFilter: string;
  filteredCount: number;
  onPrint: () => void;
}

export default function FilterSummary({
  gradeFilter,
  streamFilter,
  filteredCount,
  onPrint,
}: FilterSummaryProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
      <div className="flex items-center gap-2 text-amber-400">
        <GraduationCap className="h-4 w-4" />
        <span className="text-sm font-bold">
          {gradeFilter || "All"} {streamFilter ? `— ${streamFilter}` : ""}
        </span>
      </div>

      <div className="h-4 w-px bg-white/10" />

      <span className="text-xs text-white/50">{filteredCount} students</span>

      <span className="text-[10px] text-sky-400 font-semibold bg-sky-400/10 border border-sky-400/15 rounded-md px-2 py-0.5">
        { /* You can pass gender counts if needed */ }
      </span>

      <div className="ml-auto">
        <button
          onClick={onPrint}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white transition-all"
        >
          <Printer className="h-3.5 w-3.5" /> Print Register
        </button>
      </div>
    </div>
  );
}