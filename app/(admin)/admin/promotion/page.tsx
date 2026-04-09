// app/admin/promotion/page.tsx
import { fetchGradesForPromotion } from "@/lib/actions/promotion";
import { ArrowRight, GraduationCap } from "lucide-react";
import { PromotionClient } from "./PromotionClient";
import { CBC_ORDER } from "@/lib/utils/promotion-utils";

export const metadata = {
  title: "Grade Promotion | Kibali Academy Admin",
  description: "End-of-year CBC grade promotion — advance all students to the next grade",
};

export const dynamic = "force-dynamic";

// Shared utility for consistent stats/progression colors
const getGradeCategory = (grade: string) => {
  if (["PP1", "PP2", "Grade 1", "Grade 2", "Grade 3"].includes(grade)) return "lower";
  if (["Grade 4", "Grade 5", "Grade 6"].includes(grade)) return "upper";
  return "junior";
};

export default async function PromotionPage() {
  const grades = await fetchGradesForPromotion();
  
  const totalStudents = grades.reduce((s, g) => s + g.count, 0);
  const promotableCount = grades
    .filter((g) => g.next !== null)
    .reduce((s, g) => s + g.count, 0);
  const graduatingCount = grades
    .filter((g) => g.next === null)
    .reduce((s, g) => s + g.count, 0);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[500px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.03] blur-[100px]" />
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20">
              <GraduationCap className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                Kibali Academy · Admin
              </p>
              <h1 className="text-xl font-bold tracking-tight text-white">
                CBC Grade Promotion
              </h1>
              <p className="text-xs text-white/30 mt-0.5">
                Manage academic progression and stream allocations for the next year
              </p>
            </div>
          </div>
        </header>

        {/* Stats Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Active Students", value: totalStudents, color: "text-white" },
            {
              label: "Ready to Advance",
              value: promotableCount,
              color: "text-amber-400",
            },
            {
              label: "Graduating (Terminal)",
              value: graduatingCount,
              color: "text-emerald-400",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 text-center"
            >
              <p className={`text-3xl font-bold tabular-nums ${color}`}>
                {value}
              </p>
              <p className="text-[9px] uppercase tracking-widest text-white/30 mt-1">
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Dynamic progression map derived from CBC_ORDER */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-4">
            Standard CBC Progression Path
          </p>
          <div className="flex flex-wrap items-center gap-y-3 gap-x-2">
            {CBC_ORDER.map((g: string, i: number) => {
              const category = getGradeCategory(g);
              return (
                <div key={g} className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap
                    ${category === 'lower' ? "border-amber-400/20 bg-amber-400/8 text-amber-400" : ""}
                    ${category === 'upper' ? "border-sky-400/20 bg-sky-400/8 text-sky-400" : ""}
                    ${category === 'junior' ? "border-emerald-400/20 bg-emerald-400/8 text-emerald-400" : ""}
                  `}
                  >
                    {g}
                  </span>
                  {i < CBC_ORDER.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-white/15 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Promotion Logic Container */}
        <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
          <PromotionClient initialGrades={grades} />
        </section>

        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy · CBC School Management System · Year 2026 Refactor
          </p>
        </footer>
      </main>
    </div>
  );
}