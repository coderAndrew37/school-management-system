"use client";

import { fmt, cn } from "./fees.utils";

interface Props {
  totalDue: number;
  totalPaid: number;
  overdueCount: number;
}

export function FeesSummaryStrip({ totalDue, totalPaid, overdueCount }: Props) {
  const tiles = [
    { label: "Total Due",    value: fmt(totalDue),              color: "text-white" },
    { label: "Collected",    value: fmt(totalPaid),             color: "text-emerald-400" },
    { label: "Outstanding",  value: fmt(totalDue - totalPaid),  color: "text-amber-400" },
    { label: "Overdue",      value: String(overdueCount),       color: "text-rose-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {tiles.map(({ label, value, color }) => (
        <div
          key={label}
          className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-center"
        >
          <p className={cn("text-lg font-bold tabular-nums", color)}>{value}</p>
          <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}