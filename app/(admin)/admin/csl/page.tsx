// ─────────────────────────────────────────────────────────────────────────────
// app/(admin)/admin/csl/page.tsx
// Route: /admin/csl
// CSL Logbook admin dashboard — Grade 9 class view
// ─────────────────────────────────────────────────────────────────────────────

import { BookMarked, Info } from "lucide-react";
import { getCSLClassData } from "@/lib/data/csl-aggregator";
import { CSLDashboard } from "@/app/_components/csl/CSLDashboard";

export const metadata = {
  title: "CSL Logbook | Kibali Academy",
  description:
    "Community Service Learning logbook — Grade 9 class view and SBA grading.",
};

export const revalidate = 0;

const GRADE = "Grade 9 / JSS 3";
const YEAR = 2026;

export default async function CSLPage() {
  const summaries = await getCSLClassData(GRADE, YEAR);
  const total = summaries.length;
  const onTarget = summaries.filter(
    (s) => s.performance.totalHours >= 20,
  ).length;
  const pending = summaries
    .flatMap((s) => s.entries)
    .filter((e) => e.supervisor_status === "pending").length;

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 right-1/4 w-[600px] h-[400px] rounded-full bg-sky-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-purple-500/[0.025] blur-[100px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/70">
              Kibali Academy · CSL
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/10 border border-sky-400/20">
                <BookMarked className="h-5 w-5 text-sky-400" />
              </div>
              CSL Logbook
            </h1>
            <p className="mt-1 text-xs text-white/35 ml-12">
              {total} students · {onTarget} on target (20h) · {pending} entries
              awaiting review · AY {YEAR}
            </p>
          </div>
        </header>

        {/* Context */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-xs text-white/40 leading-relaxed">
            <span className="font-bold text-white/60">CSL SBA Grade:</span>{" "}
            Performance level (EE/ME/AE/BE) is calculated from total hours (60%
            weight) and reflection quality — average word count vs 30-word
            minimum (40% weight). Target:{" "}
            <strong className="text-sky-400/70">20 hours</strong> per year.
            Composite ≥90% = EE, ≥65% = ME, ≥40% = AE, below = BE.
          </p>
        </div>

        <CSLDashboard summaries={summaries} academicYear={YEAR} />
      </main>
    </div>
  );
}
