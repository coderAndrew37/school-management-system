"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import type {
  GradeEnrollmentBar,
  ScoreDistItem,
  RecentAdmission,
} from "@/lib/data/dashboard";

// ── Custom Tooltip Component ─────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string | number;
  prefix?: string;
  suffix?: string;
  showLabel?: boolean;
  labelMap?: Record<string, string>;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  prefix = "",
  suffix = "",
  showLabel = true,
  labelMap,
}: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const displayLabel = labelMap && label ? labelMap[label] : label;

    return (
      <div className="bg-[#141824] border border-white/10 p-3 rounded-xl shadow-2xl backdrop-blur-md">
        {showLabel && displayLabel && (
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">
            {displayLabel}
          </p>
        )}
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    entry.color || entry.payload.fill || "#fbbf24",
                }}
              />
              <span className="text-xs text-white/70 font-medium">
                {entry.name}:
              </span>
              <span className="text-xs text-white font-bold tabular-nums">
                {prefix}
                {entry.value}
                {suffix}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// ── 1. Grade Enrollment Bar Chart ─────────────────────────────────────────────

const LEVEL_COLORS: Record<string, { male: string; female: string }> = {
  lower_primary: { male: "#f59e0b", female: "#fb923c" },
  upper_primary: { male: "#38bdf8", female: "#818cf8" },
  junior_secondary: { male: "#34d399", female: "#a78bfa" },
};

interface EnrollmentChartProps {
  data: GradeEnrollmentBar[];
}

export function EnrollmentChart({ data }: EnrollmentChartProps) {
  if (data.length === 0) return <EmptyChart label="No enrollment data yet" />;

  const chartData = data.map((d) => ({
    ...d,
    label: d.grade
      .replace("Grade ", "G")
      .replace(" / JSS 1", "")
      .replace(" / JSS 2", "")
      .replace(" / JSS 3", "")
      .replace("PP1", "PP1")
      .replace("PP2", "PP2"),
  }));

  const labelMap = Object.fromEntries(chartData.map((d) => [d.label, d.grade]));

  function maleColor(level: string) {
    return LEVEL_COLORS[level]?.male ?? "#f59e0b";
  }
  function femaleColor(level: string) {
    return LEVEL_COLORS[level]?.female ?? "#fb923c";
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} barSize={14} barGap={2}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="label"
          tick={{
            fontSize: 9,
            fill: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-mono)",
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{
            fontSize: 9,
            fill: "rgba(255,255,255,0.25)",
            fontFamily: "var(--font-mono)",
          }}
          axisLine={false}
          tickLine={false}
          width={24}
          allowDecimals={false}
        />
        <Tooltip
          content={<CustomTooltip labelMap={labelMap} />}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar dataKey="male" name="Male" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={`male-${i}`}
              fill={maleColor(entry.level)}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
        <Bar dataKey="female" name="Female" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={`female-${i}`}
              fill={femaleColor(entry.level)}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── 2. Score Distribution Donut ───────────────────────────────────────────────

interface ScoreDonutProps {
  data: ScoreDistItem[];
}

export function ScoreDonut({ data }: ScoreDonutProps) {
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) return <EmptyChart label="No assessments recorded yet" />;

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={46}
            outerRadius={72}
            paddingAngle={3}
            dataKey="count"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.score} fill={entry.color} fillOpacity={0.9} />
            ))}
          </Pie>
          <Tooltip
            content={
              <CustomTooltip
                showLabel={false}
                suffix={` (${data[0]?.percent ?? 0}%)`}
              />
            }
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-col gap-2.5 flex-1 min-w-0">
        {data.map((d) => (
          <div
            key={d.score}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="flex-shrink-0 w-2.5 h-2.5 rounded-sm"
                style={{ background: d.color }}
              />
              <span className="text-[11px] font-bold text-white truncate">
                {d.score}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-white/30 tabular-nums">
                {d.count}
              </span>
              <span
                className="text-[10px] font-semibold tabular-nums w-8 text-right"
                style={{ color: d.color }}
              >
                {d.percent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3. Gender Donut ────────────────────────────────────────────────────────────

interface GenderDonutProps {
  male: number;
  female: number;
  unknown: number;
}

export function GenderDonut({ male, female, unknown }: GenderDonutProps) {
  const total = male + female + unknown;
  if (total === 0) return <EmptyChart label="No student data yet" />;

  const data = [
    { name: "Male", value: male, color: "#38bdf8" },
    { name: "Female", value: female, color: "#fb7185" },
    ...(unknown > 0
      ? [{ name: "Unknown", value: unknown, color: "#334155" }]
      : []),
  ].filter((d) => d.value > 0);

  const malePct = total > 0 ? Math.round((male / total) * 100) : 0;
  const femalePct = total > 0 ? Math.round((female / total) * 100) : 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={56}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip showLabel={false} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-lg font-black text-white tabular-nums">{total}</p>
          <p className="text-[8px] uppercase tracking-wider text-white/30">
            Total
          </p>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        {[
          { label: "Male", value: male, pct: malePct, color: "#38bdf8" },
          { label: "Female", value: female, pct: femalePct, color: "#fb7185" },
        ].map((r) => (
          <div key={r.label}>
            <div className="flex items-center justify-between mb-1">
              <span
                className="text-xs font-semibold"
                style={{ color: r.color }}
              >
                {r.label}
              </span>
              <span className="text-xs font-mono text-white/50">
                {r.value} · {r.pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${r.pct}%`, background: r.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4. Recent Admissions Area Chart ──────────────────────────────────────────

interface AdmissionsTrendProps {
  data: RecentAdmission[];
}

export function AdmissionsTrend({ data }: AdmissionsTrendProps) {
  const hasData = data.some((d) => d.count > 0);
  if (!hasData)
    return <EmptyChart label="No admissions in the last 6 months" />;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
      >
        <defs>
          <linearGradient id="admissionsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="month"
          tick={{
            fontSize: 9,
            fill: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-mono)",
          }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{
            fontSize: 9,
            fill: "rgba(255,255,255,0.25)",
            fontFamily: "var(--font-mono)",
          }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip
          content={<CustomTooltip suffix=" Admissions" />}
          cursor={{ stroke: "rgba(245, 158, 11, 0.2)", strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Admissions"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#admissionsGrad)"
          dot={{ fill: "#f59e0b", strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5, fill: "#f59e0b", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-[140px]">
      <p className="text-xs text-white/25">{label}</p>
    </div>
  );
}
