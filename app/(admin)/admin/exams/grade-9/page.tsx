// ─────────────────────────────────────────────────────────────────────────────
// app/(admin)/admin/exams/grade-9/page.tsx
// Route: /admin/exams/grade-9
// Grade 9 KESSCE Transition Dashboard — Performance vs Pathway Analysis
// ─────────────────────────────────────────────────────────────────────────────

// ✅ Import data fetcher from the aggregator (Server Only)
import { getKESSCEClassData } from "@/lib/data/jss-final-aggregator";
// ✅ Import the readiness logic from the utils (Browser/Server Neutral)
import { getKESSCEReadiness } from "@/lib/utils/kessce-logic";

import { Brain, FileSpreadsheet, GraduationCap, Info } from "lucide-react";
import { KESSCEClient } from "../_components/KESSCEClient";

export const metadata = {
  title: "Grade 9 KESSCE | Kibali Academy",
  description:
    "JSS 3 KESSCE transition dashboard — pathway analysis and SBA export.",
};

export const revalidate = 0;

const GRADE = "Grade 9 / JSS 3";
const G9YEAR = 2026;

export default async function Grade9ExamPage() {
  // Fetch class data on the server
  const results = await getKESSCEClassData(GRADE, G9YEAR);

  const total = results.length;
  // This call is now safe because getKESSCEReadiness is in a neutral utils file
  const ready = results.filter((r) => getKESSCEReadiness(r) === "ready").length;
  const counseling = results.filter((r) => r.counseling.required).length;
  const noPathway = results.filter((r) => !r.pathway.pathwayCluster).length;

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 right-1/3   w-[600px] h-[400px] rounded-full bg-purple-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 left-0    w-80 h-80 rounded-full bg-sky-500/[0.025]     blur-[100px]" />
        <div className="absolute top-1/2 right-0    w-60 h-60 rounded-full bg-emerald-500/[0.025] blur-[100px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Page header ───────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-purple-400/70">
              Kibali Academy · KNEC Exports
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-400/10 border border-purple-400/20">
                <FileSpreadsheet className="h-5 w-5 text-purple-400" />
              </div>
              Grade 9 KESSCE Dashboard
            </h1>
            <p className="mt-1 text-xs text-white/35 ml-12">
              {total} learners · {ready} ready · {counseling} counseling
              required · AY {G9YEAR}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-400/[0.06] px-4 py-2.5">
              <GraduationCap className="h-4 w-4 text-purple-400" />
              <span className="text-sm font-bold text-purple-400">{GRADE}</span>
            </div>
            {counseling > 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-2.5">
                <Brain className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-400">
                  {counseling} need counseling
                </span>
              </div>
            )}
          </div>
        </header>

        {/* ── Year strip ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Grade 7 / JSS 1",
              year: G9YEAR - 2,
              color: "text-sky-400",
              border: "border-sky-400/20",
              bg: "bg-sky-400/[0.05]",
            },
            {
              label: "Grade 8 / JSS 2",
              year: G9YEAR - 1,
              color: "text-violet-400",
              border: "border-violet-400/20",
              bg: "bg-violet-400/[0.05]",
            },
            {
              label: "Grade 9 / JSS 3",
              year: G9YEAR,
              color: "text-purple-400",
              border: "border-purple-400/20",
              bg: "bg-purple-400/[0.05]",
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

        {/* ── Context note ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4 space-y-2">
          <p className="text-xs text-white/40 leading-relaxed">
            <span className="font-bold text-white/60">
              KESSCE Export Logic:
            </span>{" "}
            Each subject shows a 3-year average (G7 + G8 + G9) from final SBA
            assessments (
            <code className="text-amber-400/60 text-[10px]">
              is_final_sba = true
            </code>
            ). The recommended Senior School Track is derived from the student's{" "}
            <code className="text-purple-400/60 text-[10px]">
              pathway_cluster
            </code>
            . The Excel export includes three sheets: main KESSCE data,
            counseling list, and full readiness summary.
          </p>
          <p className="text-xs text-white/30 flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            <span className="font-bold text-amber-400">
              Counseling Required
            </span>{" "}
            flag is raised when a STEM-pathway student's Maths or Integrated
            Science average falls below 50%. This is a guidance flag only — it
            does not block export.
          </p>
          {noPathway > 0 && (
            <p className="text-xs text-rose-400/70 flex items-center gap-1.5">
              <Info className="h-3 w-3" />
              {noPathway} student{noPathway !== 1 ? "s have" : " has"} no
              pathway cluster set. Use the Parent Portal JSS Pathway tab or the
              student record to set one before export.
            </p>
          )}
        </div>

        {/* ── Main client ───────────────────────────────────────────────────── */}
        <KESSCEClient results={results} g9Year={G9YEAR} />
      </main>
    </div>
  );
}
