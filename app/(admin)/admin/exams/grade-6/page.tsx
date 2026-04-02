// ─────────────────────────────────────────────────────────────────────────────
// app/(admin)/admin/exams/grade-6/page.tsx
// Route: /admin/exams/grade-6
// Grade 6 KPSEA Cumulative SBA Dashboard
// TanStack Query adoption: replace getKPSEACumulativeData with
// useKPSEAData() hook backed by /api/kpsea route + Dexie.js offline store.
// ─────────────────────────────────────────────────────────────────────────────

import { getKPSEACumulativeData } from "@/lib/data/kpsa-engine";
import { FileSpreadsheet, GraduationCap, Info } from "lucide-react";
import { KPSEAClient } from "../_components/KpseaClient";

export const metadata = {
  title: "Grade 6 KPSEA Export | Kibali Academy",
  description: "KPSEA cumulative SBA dashboard — 60% school-based assessment.",
};

export const revalidate = 0;

const GRADE = "Grade 6";
const G6YEAR = 2026;

export default async function Grade6ExamPage() {
  const rows = await getKPSEACumulativeData(GRADE, G6YEAR);

  const ready = rows.filter((r) => r.readinessStatus === "ready").length;
  const total = rows.length;
  const hasOver = rows.filter((r) => r.hasOverrides).length;

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 right-1/4 w-[600px] h-[400px] rounded-full bg-sky-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-purple-500/[0.025] blur-[100px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Page header ───────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/70">
              Kibali Academy · KNEC Exports
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/10 border border-sky-400/20">
                <FileSpreadsheet className="h-5 w-5 text-sky-400" />
              </div>
              Grade 6 KPSEA Dashboard
            </h1>
            <p className="mt-1 text-xs text-white/35 ml-12">
              {total} learners · {ready} ready · {hasOver} with manual overrides
              · AY {G6YEAR}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/[0.06] px-4 py-2.5">
            <GraduationCap className="h-4 w-4 text-sky-400" />
            <span className="text-sm font-bold text-sky-400">{GRADE}</span>
          </div>
        </header>

        {/* ── Context note ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-2">
          <p className="text-xs text-white/40 leading-relaxed">
            <span className="font-bold text-white/60">KPSEA Formula:</span>{" "}
            <strong className="text-sky-400/70">60% SBA</strong> = average of
            (Grade 4 avg% + Grade 5 avg% + Grade 6 avg%) × 0.6, per KPSEA
            learning area. Composite areas: Integrated Science = Science & Tech
            + Agriculture + Home Science. Creative Arts & SS = Social Studies +
            RE + Art + Music + PHE.
          </p>
          <p className="text-xs text-white/30 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            Students with missing G4/G5 data: click "+ G4 data" or "+ G5 data"
            to enter records from their previous school's paper register. These
            will be flagged as manual overrides in the exported Excel.
          </p>
        </div>

        {/* Year columns for context */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Grade 4 Year",
              year: G6YEAR - 2,
              color: "text-purple-400",
              border: "border-purple-400/20",
              bg: "bg-purple-400/[0.05]",
            },
            {
              label: "Grade 5 Year",
              year: G6YEAR - 1,
              color: "text-amber-400",
              border: "border-amber-400/20",
              bg: "bg-amber-400/[0.05]",
            },
            {
              label: "Grade 6 Year",
              year: G6YEAR,
              color: "text-sky-400",
              border: "border-sky-400/20",
              bg: "bg-sky-400/[0.05]",
            },
          ].map(({ label, year, color, border, bg }) => (
            <div
              key={year}
              className={`rounded-2xl border ${border} ${bg} px-4 py-3 text-center`}
            >
              <p className={`text-lg font-black tabular-nums ${color}`}>
                {year}
              </p>
              <p
                className={`text-[10px] font-bold uppercase tracking-wider ${color} opacity-60 mt-0.5`}
              >
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Main client ───────────────────────────────────────────────────── */}
        <KPSEAClient rows={rows} g6Year={G6YEAR} />
      </main>
    </div>
  );
}
