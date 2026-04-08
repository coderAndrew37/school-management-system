import { AttendanceGradeSummary } from "@/lib/types/governance";
import { ChevronUp, ChevronDown } from "lucide-react";

// Define a type for the Recharts payload to avoid 'any'
interface TooltipPayload {
  payload: {
    rate: number;
    marked: number;
    [key: string]: unknown;
  };
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

export const STATUS_COLORS = {
  present: { text: "text-emerald-400", bg: "bg-emerald-400", bar: "#34d399" },
  late: { text: "text-amber-400", bg: "bg-amber-400", bar: "#f59e0b" },
  absent: { text: "text-rose-400", bg: "bg-rose-400", bar: "#fb7185" },
  excused: { text: "text-sky-400", bg: "bg-sky-400", bar: "#38bdf8" },
};

export function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-white/10 bg-[#141824] p-3 shadow-2xl backdrop-blur-md">
        <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-mono">
          {label}
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-white/60">Attendance Rate</span>
            <span className="text-xs font-bold text-emerald-400">
              {data.rate}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-white/60">Records Marked</span>
            <span className="text-xs font-medium text-white">
              {data.marked}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: keyof typeof STATUS_COLORS;
}) {
  const s = STATUS_COLORS[color];
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 text-center">
      <div className={`flex justify-center mb-1 ${s.text}`}>{icon}</div>
      <p className={`text-2xl font-bold tabular-nums ${s.text}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-white/25 mt-0.5">
        {label}
      </p>
    </div>
  );
}

export function GradeRow({
  row,
  isExpanded,
  onToggle,
}: {
  row: AttendanceGradeSummary;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Use row.rate for color logic
  const rateColor =
    row.rate >= 90
      ? "text-emerald-400"
      : row.rate >= 75
        ? "text-amber-400"
        : row.marked > 0
          ? "text-rose-400"
          : "text-white/25";

  return (
    <tr className="hover:bg-white/[0.02] transition-colors group">
      {/* Refactored: changed row.grade to row.label */}
      <td className="px-3 py-2.5 font-medium text-white text-xs">
        {row.label}
      </td>
      <td className="px-3 py-2.5 text-white/40 tabular-nums">{row.total}</td>
      <td className="px-3 py-2.5 text-white/40 tabular-nums">
        {row.marked > 0 ? row.marked : <span className="text-white/20">—</span>}
      </td>
      <td className="px-3 py-2.5 text-emerald-400 tabular-nums">
        {row.present || <span className="text-white/20">—</span>}
      </td>
      <td className="px-3 py-2.5 text-amber-400 tabular-nums">
        {row.late || <span className="text-white/20">—</span>}
      </td>
      <td className="px-3 py-2.5 text-rose-400 tabular-nums">
        {row.absent || <span className="text-white/20">—</span>}
      </td>
      <td className="px-3 py-2.5">
        {row.marked > 0 ? (
          <span className={`font-bold tabular-nums ${rateColor}`}>
            {row.rate}%
          </span>
        ) : (
          <span className="text-white/20 text-xs">not marked</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {row.marked > 0 && (
          <button
            onClick={onToggle}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-all"
          >
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </td>
    </tr>
  );
}