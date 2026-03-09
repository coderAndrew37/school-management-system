"use client";

import type { ChildWithAssessments, JssPathway } from "@/lib/types/parent";
import { JSS_PATHWAY_CLUSTERS } from "@/lib/types/parent";
import { Compass } from "lucide-react";

interface Props {
  pathway: JssPathway | null;
  child: ChildWithAssessments;
  children: ChildWithAssessments[];
}

export function PathwayPageClient({ pathway, child, children }: Props) {
  const cluster = pathway
    ? JSS_PATHWAY_CLUSTERS[pathway.pathway_cluster]
    : null;

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Compass className="h-5 w-5 text-violet-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">JSS Pathway</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {child.full_name}
            </p>
          </div>
          {children.length > 1 && (
            <div className="flex gap-1.5">
              {children.map((c) => (
                <a
                  key={c.id}
                  href={`/parent/pathway?child=${c.id}`}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    c.id === child.id
                      ? "bg-violet-600 text-white border-violet-600"
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
        {!pathway ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-4xl mb-3">🧭</p>
            <p className="text-slate-700 font-bold">No pathway guidance yet</p>
            <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
              {child.full_name}'s class teacher will complete the JSS pathway
              assessment and the guidance will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Pathway cluster hero */}
            <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg shadow-violet-200/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-violet-200 mb-2">
                Recommended Pathway
              </p>
              <div className="flex items-center gap-3">
                <span className="text-4xl">{cluster?.icon ?? "🎯"}</span>
                <div>
                  <p className="text-xl font-black leading-tight">
                    {pathway.pathway_cluster}
                  </p>
                  {pathway.guidance_date && (
                    <p className="text-xs text-violet-200 mt-1">
                      Assessed{" "}
                      {new Date(pathway.guidance_date).toLocaleDateString(
                        "en-KE",
                        { day: "numeric", month: "long", year: "numeric" },
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Career suggestions */}
            {cluster && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  Suggested Careers
                </p>
                <div className="flex flex-wrap gap-2">
                  {[...cluster.careers, ...(pathway.career_interests ?? [])]
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((career) => (
                      <span
                        key={career}
                        className="text-sm font-bold bg-violet-50 text-violet-700 border border-violet-200 px-3 py-1.5 rounded-xl"
                      >
                        {career}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* Strong subjects */}
            {pathway.strong_subjects?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  💪 Strong Subjects
                </p>
                <div className="flex flex-wrap gap-2">
                  {pathway.strong_subjects.map((s) => (
                    <span
                      key={s}
                      className="text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-xl"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Interest areas */}
            {pathway.interest_areas?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3">
                  🌟 Interest Areas
                </p>
                <div className="flex flex-wrap gap-2">
                  {pathway.interest_areas.map((i) => (
                    <span
                      key={i}
                      className="text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-xl"
                    >
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Learning style */}
            {pathway.learning_style && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">
                  📚 Learning Style
                </p>
                <p className="text-sm font-bold text-slate-700">
                  {pathway.learning_style}
                </p>
              </div>
            )}

            {/* AI Guidance */}
            {pathway.ai_guidance && (
              <div className="bg-white rounded-2xl border border-violet-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🤖</span>
                  <p className="text-xs font-black uppercase tracking-wider text-violet-600">
                    Teacher's Guidance Notes
                  </p>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {pathway.ai_guidance}
                </p>
              </div>
            )}

            {/* Info note */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-500 leading-relaxed">
                This pathway guidance is based on your child's interests,
                strengths, and performance. Speak with their class teacher for
                more information.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
