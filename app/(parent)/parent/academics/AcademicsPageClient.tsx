"use client";

import { DownloadReportButton } from "@/app/_components/shared/DownloadReportButton";
import type {
  Assessment,
  CbcScore,
  ChildWithAssessments,
} from "@/lib/types/parent";
import { GraduationCap } from "lucide-react";
import { useState } from "react";

interface Props {
  child: ChildWithAssessments;
  allChildren: ChildWithAssessments[];
}

const SCORE_STYLES: Record<
  CbcScore,
  { bg: string; text: string; border: string; label: string; numeric: number }
> = {
  EE: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Exceeding Expectation",
    numeric: 4,
  },
  ME: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    label: "Meeting Expectation",
    numeric: 3,
  },
  AE: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Approaching Expectation",
    numeric: 2,
  },
  BE: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    label: "Below Expectation",
    numeric: 1,
  },
};

const SCORE_BAR_W: Record<CbcScore, string> = {
  EE: "w-full",
  ME: "w-3/4",
  AE: "w-1/2",
  BE: "w-1/4",
};
const SCORE_BAR_C: Record<CbcScore, string> = {
  EE: "bg-emerald-400",
  ME: "bg-blue-400",
  AE: "bg-amber-400",
  BE: "bg-rose-400",
};

function getOverallLevel(assessments: Assessment[]): {
  label: string;
  emoji: string;
  color: string;
} {
  const scored = assessments.filter((a) => a.score);
  if (scored.length === 0)
    return { label: "No data", emoji: "📊", color: "text-slate-400" };
  const avg =
    scored.reduce((sum, a) => sum + SCORE_STYLES[a.score!].numeric, 0) /
    scored.length;
  if (avg >= 3.5)
    return {
      label: "Exceeding Expectations",
      emoji: "🌟",
      color: "text-emerald-600",
    };
  if (avg >= 2.5)
    return {
      label: "Meeting Expectations",
      emoji: "✅",
      color: "text-blue-600",
    };
  if (avg >= 1.5)
    return {
      label: "Approaching Expectations",
      emoji: "📈",
      color: "text-amber-600",
    };
  return { label: "Needs Support", emoji: "🤝", color: "text-rose-600" };
}

/**
 * Derive per-subject competency averages from assessments.
 * Since student_competencies table doesn't exist, we compute this from
 * the assessments table — each subject's average CBC score becomes its
 * competency level. Returns subjects sorted best→worst.
 */
function deriveCompetencies(
  assessments: Assessment[],
): { subject: string; avg: number; count: number; topScore: CbcScore }[] {
  const bySubject = new Map<string, number[]>();
  for (const a of assessments) {
    if (!a.score) continue;
    const nums = bySubject.get(a.subject_name) ?? [];
    nums.push(SCORE_STYLES[a.score].numeric);
    bySubject.set(a.subject_name, nums);
  }
  return Array.from(bySubject.entries())
    .map(([subject, nums]) => {
      const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
      // Map avg back to closest CBC grade
      const topScore: CbcScore =
        avg >= 3.5 ? "EE" : avg >= 2.5 ? "ME" : avg >= 1.5 ? "AE" : "BE";
      return { subject, avg, count: nums.length, topScore };
    })
    .sort((a, b) => b.avg - a.avg);
}

export function AcademicsPageClient({ child, allChildren }: Props) {
  const [activeTerm, setActiveTerm] = useState<0 | 1 | 2 | 3>(0); // 0 = all

  const allAssessments = child.assessments;
  const terms: (1 | 2 | 3)[] = [
    ...new Set(allAssessments.map((a) => a.term)),
  ].sort() as (1 | 2 | 3)[];

  const filtered =
    activeTerm === 0
      ? allAssessments
      : allAssessments.filter((a) => a.term === activeTerm);

  // Latest score per subject (for the filtered term)
  const latestBySubject = new Map<string, Assessment>();
  for (const a of [...filtered].reverse()) {
    if (a.score && !latestBySubject.has(a.subject_name)) {
      latestBySubject.set(a.subject_name, a);
    }
  }
  const subjectEntries = Array.from(latestBySubject.entries()).sort(
    (a, b) =>
      SCORE_STYLES[b[1].score!].numeric - SCORE_STYLES[a[1].score!].numeric,
  );

  const overall = getOverallLevel(filtered.filter((a) => a.score !== null));

  // Score distribution
  const dist = { EE: 0, ME: 0, AE: 0, BE: 0 } as Record<CbcScore, number>;
  for (const [, a] of subjectEntries) if (a.score) dist[a.score]++;

  // Competency profile derived from ALL assessments across terms
  // (not filtered — gives full picture of the child's strengths)
  const competencies = deriveCompetencies(allAssessments);

  // Academic year from assessments (fallback to current year)
  const academicYear =
    allAssessments.find((a) => a.academic_year)?.academic_year ?? 2026;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-blue-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">Academics</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {child.full_name} · {child.current_grade}
            </p>
          </div>
          {allChildren.length > 1 && (
            <div className="flex gap-1.5">
              {allChildren.map((c) => (
                <a
                  key={c.id}
                  href={`/parent/academics?child=${c.id}`}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    c.id === child.id
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  {c.full_name.split(" ")[0]}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Term tabs */}
        <div className="flex gap-2 bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
          {([0, ...terms] as (0 | 1 | 2 | 3)[]).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTerm(t)}
              className={[
                "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                activeTerm === t
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {t === 0 ? "All Terms" : `Term ${t}`}
            </button>
          ))}
        </div>

        {/* Download report card — shown when a specific term is selected */}
        {activeTerm !== 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-black text-slate-700">
                Term {activeTerm} Report Card
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Download your child&apos;s official CBC report
              </p>
            </div>
            <DownloadReportButton
              studentId={child.id}
              studentName={child.full_name}
              term={activeTerm}
              year={academicYear}
              variant="link"
            />
          </div>
        )}

        {/* Overall level */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
          <span className="text-4xl">{overall.emoji}</span>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              Overall Level
            </p>
            <p className={`text-lg font-black ${overall.color}`}>
              {overall.label}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {subjectEntries.length} subjects assessed
            </p>
          </div>
        </div>

        {/* Score distribution */}
        {subjectEntries.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4">
              Score Distribution
            </p>
            <div className="grid grid-cols-4 gap-2">
              {(["EE", "ME", "AE", "BE"] as CbcScore[]).map((s) => {
                const ss = SCORE_STYLES[s];
                return (
                  <div
                    key={s}
                    className={`rounded-xl border ${ss.bg} ${ss.border} p-3 text-center`}
                  >
                    <p className={`text-2xl font-black ${ss.text}`}>
                      {dist[s]}
                    </p>
                    <p className={`text-xs font-black ${ss.text}`}>{s}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">
                      {ss.label.split(" ")[0]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Competency strength profile (derived from assessments) ───────── */}
        {competencies.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                Subject Strength Profile
              </p>
              <span className="text-[10px] text-slate-400 font-medium">
                All terms · avg score
              </span>
            </div>
            <div className="space-y-2.5">
              {competencies.map(({ subject, avg, count, topScore }) => {
                const ss = SCORE_STYLES[topScore];
                // Width as % of 4 (max), clamped to Tailwind values
                const pct = Math.round((avg / 4) * 100);
                return (
                  <div key={subject}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">
                          {subject}
                        </p>
                        <span className="text-[9px] text-slate-400 shrink-0">
                          {count} strand{count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-lg border ml-2 ${ss.bg} ${ss.text} ${ss.border}`}
                      >
                        {topScore}
                      </span>
                    </div>
                    {/* Progress bar — inline width via style since we need dynamic % */}
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${SCORE_BAR_C[topScore]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Subject list */}
        {subjectEntries.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">📊</p>
            <p className="text-slate-500 font-semibold">No assessments yet</p>
            {activeTerm !== 0 && (
              <button
                onClick={() => setActiveTerm(0)}
                className="text-xs text-blue-500 font-semibold mt-2 hover:underline"
              >
                View all terms
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              Subjects
            </p>
            {subjectEntries.map(([subject, a]) => {
              const ss = SCORE_STYLES[a.score!];
              // History for this subject in filtered term
              const history = filtered
                .filter((x) => x.subject_name === subject && x.score)
                .sort(
                  (x, y) =>
                    new Date(y.created_at).getTime() -
                    new Date(x.created_at).getTime(),
                );

              return (
                <div
                  key={subject}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">
                        {subject}
                      </p>
                      <p className="text-xs text-slate-400">{a.strand_id}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block text-sm font-black px-3 py-1 rounded-xl border ${ss.bg} ${ss.text} ${ss.border}`}
                      >
                        {a.score}
                      </span>
                      <p
                        className={`text-[10px] font-semibold mt-0.5 ${ss.text}`}
                      >
                        {ss.label}
                      </p>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${SCORE_BAR_W[a.score!]} ${SCORE_BAR_C[a.score!]}`}
                    />
                  </div>

                  {a.teacher_remarks && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                        Teacher&apos;s Remarks
                      </p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {a.teacher_remarks}
                      </p>
                    </div>
                  )}

                  {/* Score history pills */}
                  {history.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[9px] text-slate-400 font-semibold">
                        History:
                      </p>
                      {history.map((h, i) => {
                        const hs = SCORE_STYLES[h.score!];
                        return (
                          <span
                            key={h.id}
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${hs.bg} ${hs.text} ${hs.border} ${i === 0 ? "opacity-100" : "opacity-50"}`}
                          >
                            {h.score}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* CBC score legend */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">
            CBC Score Guide
          </p>
          <div className="space-y-2">
            {(["EE", "ME", "AE", "BE"] as CbcScore[]).map((s) => {
              const ss = SCORE_STYLES[s];
              return (
                <div key={s} className="flex items-center gap-3">
                  <span
                    className={`text-xs font-black w-8 text-center px-1.5 py-0.5 rounded-md border ${ss.bg} ${ss.text} ${ss.border}`}
                  >
                    {s}
                  </span>
                  <p className="text-xs text-slate-600">{ss.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
