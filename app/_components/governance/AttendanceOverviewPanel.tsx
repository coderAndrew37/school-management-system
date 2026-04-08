"use client";

import type {
  AttendanceOverview,
  AttendanceGradeSummary
} from "@/lib/types/governance";
import {
  CalendarCheck,
  Clock,
  TrendingUp,
  UserCheck,
  UserX
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SummaryCard, STATUS_COLORS, GradeRow, CustomTooltip } from "./utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  initial: AttendanceOverview;
  /** Server action: fetch overview for a different date */
  fetchFn: (date: string) => Promise<AttendanceOverview>;
}

interface TrendDataItem {
  label: string;
  rate: number;
  marked: number;
  isToday: boolean;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: TrendDataItem;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AttendanceOverviewPanel({ initial, fetchFn }: Props) {
  const [data, setData] = useState<AttendanceOverview>(initial);
  const [date, setDate] = useState<string>(initial.date);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    startTransition(async () => {
      const fresh = await fetchFn(newDate);
      setData(fresh);
    });
  };

  const {
    present,
    late,
    absent,
    excused,
    totalMarked,
    totalStudents,
    presentRate,
  } = data;

  const rateColor =
    presentRate >= 90
      ? "text-emerald-400"
      : presentRate >= 75
        ? "text-amber-400"
        : "text-rose-400";

  const trendData: TrendDataItem[] = data.recentDays.map((d) => {
    const dt = new Date(d.date + "T00:00:00");
    return {
      label: dt.toLocaleDateString("en-KE", {
        weekday: "short",
        day: "numeric",
      }),
      rate: d.rate,
      marked: d.marked,
      isToday: d.date === data.date,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-white/40">
            {totalMarked > 0
              ? `${totalMarked.toLocaleString()} of ${totalStudents.toLocaleString()} students marked`
              : "No attendance marked for this date"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[10px] uppercase tracking-widest text-white/30">
            Date
          </label>
          <input
            aria-label="date"
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => handleDateChange(e.target.value)}
            disabled={isPending}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition [color-scheme:dark] focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50"
          />
          {isPending && (
            <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-sky-400 animate-spin" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="sm:col-span-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-4 flex flex-col items-center justify-center text-center">
          <TrendingUp className={`h-5 w-5 mb-1 ${rateColor}`} />
          <p className={`text-3xl font-black tabular-nums ${rateColor}`}>
            {presentRate}%
          </p>
          <p className="text-[9px] uppercase tracking-widest text-white/30 mt-0.5">
            Attendance Rate
          </p>
        </div>

        <SummaryCard
          icon={<UserCheck className="h-4 w-4" />}
          label="Present"
          value={present}
          color="present"
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4" />}
          label="Late"
          value={late}
          color="late"
        />
        <SummaryCard
          icon={<UserX className="h-4 w-4" />}
          label="Absent"
          value={absent}
          color="absent"
        />
        <SummaryCard
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Excused"
          value={excused}
          color="excused"
        />
      </div>

      {totalMarked > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">
            Distribution · {totalMarked} records
          </p>
          <div className="h-3 rounded-full overflow-hidden flex gap-0.5">
            {(["present", "late", "excused", "absent"] as const).map(
              (status) => {
                const count = data[status];
                const pct = totalMarked > 0 ? (count / totalMarked) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={status}
                    className={`h-full rounded-full ${STATUS_COLORS[status].bg} transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                    title={`${status}: ${count} (${Math.round(pct)}%)`}
                  />
                );
              },
            )}
          </div>
          <div className="flex flex-wrap gap-4 mt-3">
            {(["present", "late", "excused", "absent"] as const).map(
              (status) => {
                const count = data[status];
                const pct =
                  totalMarked > 0 ? Math.round((count / totalMarked) * 100) : 0;
                return (
                  <span
                    key={status}
                    className="flex items-center gap-1.5 text-[10px] text-white/40"
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${STATUS_COLORS[status].bg}`}
                    />
                    <span className="capitalize">{status}</span>
                    <span className={`font-bold ${STATUS_COLORS[status].text}`}>
                      {count}
                    </span>
                    <span className="text-white/25">({pct}%)</span>
                  </span>
                );
              },
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">
            By Grade
          </p>
          {data.byClass.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center">
              <p className="text-sm text-white/30">No grade data available</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-white/[0.04] border-b border-white/[0.07]">
                  <tr>
                    {[
                      "Grade",
                      "Enrolled",
                      "Marked",
                      "Present",
                      "Late",
                      "Absent",
                      "Rate",
                      "",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-widest text-white/25"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.byClass.map((row: AttendanceGradeSummary) => (
                    <GradeRow
                      key={row.class_id}
                      row={row}
                      isExpanded={expanded === row.class_id}
                      onToggle={() =>
                        setExpanded((e) => (e === row.class_id ? null : row.class_id))
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-3">
            Attendance Rate — last 14 days
          </p>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            {trendData.some((d) => d.marked > 0) ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={trendData}
                  margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                >
                  <defs>
                    <linearGradient id="attendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop
                        offset="100%"
                        stopColor="#34d399"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="rgba(255,255,255,0.04)"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 8,
                      fill: "rgba(255,255,255,0.25)",
                      fontFamily: "var(--font-mono)",
                    }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{
                      fontSize: 8,
                      fill: "rgba(255,255,255,0.2)",
                      fontFamily: "var(--font-mono)",
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke="#34d399"
                    strokeWidth={2}
                    fill="url(#attendGrad)"
                    dot={(props: DotProps) => {
                      const { cx, cy, payload } = props;
                      if (cx === undefined || cy === undefined || !payload) return <g key="empty" />;
                      
                      return payload.isToday ? (
                        <circle
                          key="today"
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill="#34d399"
                          stroke="#0c0f1a"
                          strokeWidth={2}
                        />
                      ) : (
                        <circle
                          key="normal"
                          cx={cx}
                          cy={cy}
                          r={2}
                          fill="#34d399"
                          strokeWidth={0}
                        />
                      );
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[200px]">
                <p className="text-xs text-white/25">
                  No attendance records in the past 14 days
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {totalMarked === 0 && (
        <div className="rounded-2xl border border-dashed border-white/[0.08] py-14 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-sm text-white/40 font-medium">
            No attendance recorded for this date
          </p>
          <p className="text-xs text-white/20 mt-1">
            Teachers mark attendance from their portal · select a different date
            above
          </p>
        </div>
      )}
    </div>
  );
}