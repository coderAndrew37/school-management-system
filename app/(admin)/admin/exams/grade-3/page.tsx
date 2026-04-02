// ─────────────────────────────────────────────────────────────────────────────
// app/(admin)/admin/exams/grade-3/page.tsx
// Route: /admin/exams/grade-3
// Grade 3 MLP KNEC Export — server-fetches then hands off to Grade3Client
// Designed for TanStack Query migration: wrap getGrade3KnecData in a
// server action + useQuery call to enable background refetch + offline cache.
// ─────────────────────────────────────────────────────────────────────────────

import { FileSpreadsheet, GraduationCap } from "lucide-react";
import { getGrade3KnecData } from "@/lib/data/knec-aggregator";
import { Grade3Client } from "../_components/Grade3Client";

export const metadata = {
  title: "Grade 3 MLP Export | Kibali Academy",
  description: "KNEC Grade 3 MLP assessment export — aggregate and download.",
};

export const revalidate = 0;

const GRADE = "Grade 3";
const YEAR = 2026;

export default async function Grade3ExamPage() {
  const results = await getGrade3KnecData(GRADE, YEAR);

  const ready = results.filter((r) => r.issues.length === 0).length;
  const total = results.length;

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 right-1/4 w-[600px] h-[400px] rounded-full bg-emerald-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-amber-500/[0.025] blur-[100px]" />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Page header ───────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70">
              Kibali Academy · KNEC Exports
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 border border-emerald-400/20">
                <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              </div>
              Grade 3 MLP Export
            </h1>
            <p className="mt-1 text-xs text-white/35 ml-12">
              {total} learners · {ready} ready to export · Academic Year {YEAR}
            </p>
          </div>

          {/* Grade badge */}
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-2.5">
            <GraduationCap className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-bold text-emerald-400">{GRADE}</span>
          </div>
        </header>

        {/* ── Context note ──────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <p className="text-xs text-white/40 leading-relaxed">
            <span className="font-bold text-white/60">MLP Export Logic:</span>{" "}
            Each learning area rating (1–4) is derived from final SBA
            assessments (
            <code className="text-amber-400/60 text-[10px]">
              is_final_sba = true
            </code>
            ). If raw percentage scores are available they are averaged;
            otherwise the most frequent CBC score (EE/ME/AE/BE) is used. All 8
            KNEC learning areas must be present and each student must have a UPI
            before export is unlocked.
          </p>
        </div>

        {/* ── Main client ───────────────────────────────────────────────────── */}
        <Grade3Client results={results} grade={GRADE} year={YEAR} />
      </main>
    </div>
  );
}
