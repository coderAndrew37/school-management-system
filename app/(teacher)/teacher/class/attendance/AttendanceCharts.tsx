// app/teacher/class/attendance/AttendanceCharts.tsx
// Pure presentational SVG charts — no state, no side effects.

import type { Status, WeekPoint } from "./attendance-types";
import { STATUSES, STATUS_CFG } from "./attendance-types";

// ── Weekly bar chart ──────────────────────────────────────────────────────────

export function WeeklyBarChart({ data }: { data: WeekPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400 text-sm italic">
        Not enough data yet — attendance will appear here after a few weeks.
      </div>
    );
  }

  const chartH = 100;
  const chartW = 100;
  const barW = Math.min(10, (chartW / data.length) * 0.55);
  const gap = chartW / data.length;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${chartW} ${chartH + 22}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: 160 }}
      >
        {/* Grid lines */}
        {[25, 50, 75, 100].map((pct) => {
          const y = chartH - (pct / 100) * chartH;
          return (
            <g key={pct}>
              <line
                x1="0"
                y1={y}
                x2={chartW}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="0.3"
              />
              <text x="0.5" y={y - 1} fontSize="2.5" fill="#94a3b8">
                {pct}%
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {data.map((d, i) => {
          const x = i * gap + gap * 0.2;
          const barH = (d.rate / 100) * chartH;
          const y = chartH - barH;
          const color =
            d.rate >= 90 ? "#10b981" : d.rate >= 75 ? "#f59e0b" : "#ef4444";
          const isLast = i === data.length - 1;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill={color}
                rx="1.5"
                opacity={isLast ? 1 : 0.72}
              />
              <text
                x={x + barW / 2}
                y={chartH + 8}
                textAnchor="middle"
                fontSize="2.8"
                fill="#64748b"
              >
                {d.week}
              </text>
              <text
                x={x + barW / 2}
                y={y - 2}
                textAnchor="middle"
                fontSize="2.5"
                fill={color}
                fontWeight="700"
              >
                {d.rate}%
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-center gap-5 mt-1">
        {[
          { cls: "bg-emerald-500", label: "≥ 90% Good" },
          { cls: "bg-amber-400", label: "75–89% Watch" },
          { cls: "bg-rose-500", label: "< 75% At risk" },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-sm ${cls}`} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Donut chart ───────────────────────────────────────────────────────────────

const DONUT_COLORS: Record<Status, string> = {
  Present: "#10b981",
  Late: "#f59e0b",
  Absent: "#ef4444",
  Excused: "#0ea5e9",
};

// Pure accumulator function — lives outside component to satisfy react-hooks/immutability
function buildDonutSlices(counts: Record<Status, number>, total: number) {
  let cum = -90;
  return STATUSES.filter((s) => counts[s] > 0).map((s) => {
    const angle = (counts[s] / total) * 360;
    const start = cum;
    cum += angle;
    return { s, angle, start };
  });
}

export function DonutChart({
  counts,
  total,
}: {
  counts: Record<Status, number>;
  total: number;
}) {
  if (total === 0) return null;

  const r = 30;
  const cx = 40;
  const cy = 40;
  const slices = buildDonutSlices(counts, total);

  function pt(angle: number, radius: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const presentRate = Math.round(
    ((counts.Present + counts.Late) / total) * 100,
  );

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 80 80" className="w-24 h-24 shrink-0">
        {slices.map(({ s, angle, start }) => {
          const s1 = pt(start, r);
          const s2 = pt(start + angle, r);
          const lg = angle > 180 ? 1 : 0;
          return (
            <path
              key={s}
              d={`M ${cx} ${cy} L ${s1.x} ${s1.y} A ${r} ${r} 0 ${lg} 1 ${s2.x} ${s2.y} Z`}
              fill={DONUT_COLORS[s]}
              stroke="white"
              strokeWidth="1.5"
            />
          );
        })}
        <circle cx={cx} cy={cy} r="18" fill="white" />
        <text
          x={cx}
          y={cy - 3}
          textAnchor="middle"
          fontSize="9"
          fontWeight="800"
          fill="#1e293b"
        >
          {presentRate}%
        </text>
        <text
          x={cx}
          y={cy + 7}
          textAnchor="middle"
          fontSize="4.5"
          fill="#64748b"
        >
          present
        </text>
      </svg>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={`w-2 h-2 rounded-full ${STATUS_CFG[s].dot} shrink-0`}
            />
            <span className="text-xs text-slate-600">
              {STATUS_CFG[s].label}
            </span>
            <span className={`text-xs font-black ml-2 ${STATUS_CFG[s].text}`}>
              {counts[s]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sparkline (14-day mini bar) ───────────────────────────────────────────────

export function Sparkline({
  records,
}: {
  records: { date: string; status: Status }[];
}) {
  const last14 = records.slice(-14);
  if (last14.length === 0) {
    return (
      <span className="text-[10px] text-slate-300 italic">No history</span>
    );
  }

  const w = 56;
  const h = 16;
  const bw = w / last14.length - 1;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-14 h-4 shrink-0">
      {last14.map((r, i) => {
        const barH =
          r.status === "Present"
            ? h
            : r.status === "Late"
              ? h * 0.6
              : r.status === "Excused"
                ? h * 0.4
                : h * 0.15;
        const color =
          r.status === "Present"
            ? "#10b981"
            : r.status === "Late"
              ? "#f59e0b"
              : r.status === "Excused"
                ? "#0ea5e9"
                : "#ef4444";
        return (
          <rect
            key={i}
            x={i * (bw + 1)}
            y={h - barH}
            width={bw}
            height={barH}
            fill={color}
            rx="0.5"
            opacity="0.85"
          />
        );
      })}
    </svg>
  );
}
