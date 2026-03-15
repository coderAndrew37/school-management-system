"use client";

// app/_components/analytics/AnalyticsHub.tsx
// Thin orchestration shell — owns only tab state and delegates to tab components.
// All chart logic lives in AnalyticsCharts.tsx.
// All style constants live in analytics-constants.ts.

import { useState } from "react";
import {
  BarChart3,
  GraduationCap,
  BookOpen,
  TrendingUp,
  Users,
} from "lucide-react";
import type { AnalyticsOverview } from "@/lib/data/analytics";
import { OverviewTab } from "./OverviewTab";
import { EnrollmentTab } from "./EnrollmentTab";
import { SubjectsTab } from "./SubjectsTab";
import { TrendTab } from "./TrendTab";
import { StudentsTab } from "./StudentsTab";

type Tab = "overview" | "enrollment" | "subjects" | "trend" | "students";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <BarChart3 className="h-3.5 w-3.5" />,
  },
  {
    id: "enrollment",
    label: "Enrollment",
    icon: <Users className="h-3.5 w-3.5" />,
  },
  {
    id: "subjects",
    label: "Subjects",
    icon: <BookOpen className="h-3.5 w-3.5" />,
  },
  {
    id: "trend",
    label: "Term Trend",
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  },
  {
    id: "students",
    label: "Students",
    icon: <GraduationCap className="h-3.5 w-3.5" />,
  },
];

export function AnalyticsHub({ data }: { data: AnalyticsOverview }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
              tab === t.id
                ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                : "text-white/40 hover:text-white",
            ].join(" ")}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "enrollment" && <EnrollmentTab data={data} />}
      {tab === "subjects" && (
        <SubjectsTab
          subjectLeaderboard={data.subjectLeaderboard}
          snapshots={data.subjectSnapshots}
        />
      )}
      {tab === "trend" && (
        <TrendTab
          termComparison={data.termComparison}
          attendance={data.attendanceByGrade}
          admissions={data.admissionsTrend}
        />
      )}
      {tab === "students" && (
        <StudentsTab top={data.topPerformers} support={data.needsSupport} />
      )}
    </div>
  );
}
