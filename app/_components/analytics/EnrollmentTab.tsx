"use client";

// app/_components/analytics/EnrollmentTab.tsx

import type { AnalyticsOverview } from "@/lib/data/analytics";
import { LEVEL_COLOR, LEVEL_LABEL } from "./analytics-constants";
import { VBar, Donut, Sparkline } from "./AnalyticsCharts";

export function EnrollmentTab({ data }: { data: AnalyticsOverview }) {
  const maxCount = Math.max(...data.gradeEnrollment.map((g) => g.count), 1);
  const totalMale = data.gradeEnrollment.reduce((s, g) => s + g.male, 0);
  const totalFemale = data.gradeEnrollment.reduce((s, g) => s + g.female, 0);
  const unknown = data.totalStudents - totalMale - totalFemale;

  return (
    <div className="space-y-6">
      {/* Gender split + admissions trend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gender donut */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h3 className="text-sm font-bold text-white mb-4">Gender Split</h3>
          <div className="flex items-center gap-6">
            <Donut
              segments={[
                { value: totalMale, color: "#38bdf8" },
                { value: totalFemale, color: "#fb7185" },
                { value: unknown, color: "#ffffff1a" },
              ]}
              size={100}
              label={`${data.totalStudents}`}
              sublabel="total"
            />
            <div className="space-y-3 flex-1">
              {[
                {
                  label: "Male",
                  count: totalMale,
                  color: "bg-sky-400",
                  text: "text-sky-400",
                },
                {
                  label: "Female",
                  count: totalFemale,
                  color: "bg-rose-400",
                  text: "text-rose-400",
                },
                {
                  label: "Unknown",
                  count: unknown,
                  color: "bg-white/20",
                  text: "text-white/30",
                },
              ].map(({ label, count, color, text }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-sm ${color} shrink-0`} />
                  <span className="text-xs text-white/60 flex-1">{label}</span>
                  <span className={`text-sm font-bold ${text}`}>{count}</span>
                  <span className="text-[10px] text-white/25">
                    {data.totalStudents > 0
                      ? Math.round((count / data.totalStudents) * 100)
                      : 0}
                    %
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Admissions sparkline */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h3 className="text-sm font-bold text-white mb-1">
            Admissions Trend
          </h3>
          <p className="text-[10px] text-white/30 mb-4">
            New students — last 6 months
          </p>
          <Sparkline
            values={data.admissionsTrend.map((m) => m.count)}
            height={56}
          />
          <div className="flex items-center justify-between mt-2">
            {data.admissionsTrend.map((m, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] font-bold text-white/50">
                  {m.count}
                </span>
                <span className="text-[8px] text-white/25">{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vertical enrollment bar chart by grade */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h3 className="text-sm font-bold text-white mb-1">
          Enrollment by Grade
        </h3>
        <p className="text-[10px] text-white/30 mb-6">
          Active students per grade
        </p>
        <div className="flex items-end justify-around gap-1 overflow-x-auto pb-2">
          {data.gradeEnrollment.map((g) => {
            const lc = LEVEL_COLOR[g.level] ?? LEVEL_COLOR.lower_primary!;
            return (
              <VBar
                key={g.grade}
                value={g.count}
                max={maxCount}
                color={lc.dot}
                label={g.grade}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-5 mt-4 flex-wrap">
          {Object.entries(LEVEL_LABEL).map(([key, label]) => {
            const lc = LEVEL_COLOR[key]!;
            return (
              <div
                key={key}
                className="flex items-center gap-1.5 text-[10px] text-white/40"
              >
                <div className={`w-2.5 h-2.5 rounded-sm ${lc.dot}`} />
                {label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Gender split per grade (stacked horizontal bars) */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <h3 className="text-sm font-bold text-white mb-4">
          Gender Breakdown by Grade
        </h3>
        <div className="space-y-3">
          {data.gradeSnapshots.map((g) => {
            const total = g.male + g.female;
            return (
              <div
                key={g.grade}
                className="grid grid-cols-[120px_1fr_80px] items-center gap-4"
              >
                <p className="text-xs font-semibold text-white truncate">
                  {g.grade}
                </p>
                <div className="flex h-3 rounded-full overflow-hidden gap-px">
                  {g.male > 0 && (
                    <div
                      className="bg-sky-400 rounded-l-full"
                      style={{
                        width:
                          total > 0
                            ? `${Math.round((g.male / total) * 100)}%`
                            : "50%",
                      }}
                    />
                  )}
                  {g.female > 0 && (
                    <div
                      className="bg-rose-400 rounded-r-full"
                      style={{
                        width:
                          total > 0
                            ? `${Math.round((g.female / total) * 100)}%`
                            : "50%",
                      }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 justify-end text-[10px]">
                  <span className="text-sky-400">{g.male}M</span>
                  <span className="text-white/20">/</span>
                  <span className="text-rose-400">{g.female}F</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
            <div className="w-2.5 h-2.5 rounded-sm bg-sky-400" /> Male
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
            <div className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Female
          </div>
        </div>
      </div>
    </div>
  );
}
