"use client";

// app/parent/reports/ParentReportsClient.tsx

import Link from "next/link";
import { FileText, Download, Printer, ChevronRight } from "lucide-react";
import type { ParentReportCard } from "@/lib/data/parent";
import type { ChildWithAssessments } from "@/lib/types/parent";

interface Props {
  children: ChildWithAssessments[];
  activeChildId: string;
  activeChildName: string;
  activeChildGrade: string;
  reportCards: ParentReportCard[];
  currentTerm: number;
  currentYear: number;
}

const TERM_LABEL: Record<number, string> = {
  1: "Term 1",
  2: "Term 2",
  3: "Term 3",
};
const CONDUCT_COLOR: Record<string, string> = {
  Excellent: "text-emerald-600 bg-emerald-50 border-emerald-200",
  Good: "text-sky-600    bg-sky-50    border-sky-200",
  Satisfactory: "text-amber-600  bg-amber-50  border-amber-200",
  "Needs Improvement": "text-rose-600   bg-rose-50   border-rose-200",
};

function getReportUrl(studentId: string, term: number, year: number) {
  return `/api/report-pdf?studentId=${encodeURIComponent(studentId)}&term=${term}&year=${year}`;
}

function ChildTab({
  child,
  isActive,
}: {
  child: ChildWithAssessments;
  isActive: boolean;
}) {
  const initials = child.full_name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  return (
    <Link
      href={`/parent/reports?child=${child.id}`}
      className={[
        "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all",
        isActive
          ? "bg-sky-50 border-sky-300 text-sky-700"
          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300",
      ].join(" ")}
    >
      <div
        className={[
          "w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black",
          isActive ? "bg-sky-200 text-sky-700" : "bg-slate-100 text-slate-500",
        ].join(" ")}
      >
        {initials}
      </div>
      <span className="truncate max-w-[100px]">
        {child.full_name.split(" ")[0]}
      </span>
    </Link>
  );
}

export function ParentReportsClient({
  children,
  activeChildId,
  activeChildName,
  activeChildGrade,
  reportCards,
  currentTerm,
  currentYear,
}: Props) {
  const initials = activeChildName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center">
              <FileText className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">Report Cards</p>
              <p className="text-[10px] text-slate-400">
                {activeChildGrade} · {reportCards.length} report
                {reportCards.length !== 1 ? "s" : ""} available
              </p>
            </div>
          </div>

          {/* Child switcher */}
          {children.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {children.map((child) => (
                <ChildTab
                  key={child.id}
                  child={child}
                  isActive={child.id === activeChildId}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {reportCards.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-slate-700 font-bold">No reports yet</p>
            <p className="text-sm text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Report cards will appear here once your child's class teacher
              publishes them at the end of each term.
            </p>
          </div>
        ) : (
          <>
            {/* Current term callout if available */}
            {(() => {
              const current = reportCards.find(
                (r) =>
                  r.term === currentTerm && r.academic_year === currentYear,
              );
              if (!current) return null;
              return (
                <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-sky-600 mb-1">
                        Current Term
                      </p>
                      <p className="text-sm font-bold text-slate-800">
                        {TERM_LABEL[current.term]} {current.academic_year}
                      </p>
                      {current.class_teacher_remarks && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 italic">
                          "{current.class_teacher_remarks}"
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <a
                        href={getReportUrl(
                          activeChildId,
                          current.term,
                          current.academic_year,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700 transition-colors"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        View
                      </a>
                      <a
                        href={getReportUrl(
                          activeChildId,
                          current.term,
                          current.academic_year,
                        )}
                        download={`${activeChildName.replace(/\s+/g, "_")}_Term${current.term}_${current.academic_year}.pdf`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-sky-200 text-sky-700 text-xs font-bold hover:bg-sky-50 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Save
                      </a>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* All report cards grouped by year */}
            {Object.entries(
              reportCards.reduce<Record<number, ParentReportCard[]>>(
                (acc, r) => {
                  if (!acc[r.academic_year]) acc[r.academic_year] = [];
                  acc[r.academic_year]!.push(r);
                  return acc;
                },
                {},
              ),
            )
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([year, cards]) => (
                <div key={year}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 px-1">
                    Academic Year {year}
                  </p>
                  <div className="space-y-2">
                    {cards.map((card) => {
                      const isCurrent =
                        card.term === currentTerm &&
                        card.academic_year === currentYear;
                      const publishedDate = card.published_at
                        ? new Date(card.published_at).toLocaleDateString(
                            "en-KE",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )
                        : null;

                      return (
                        <div
                          key={card.id}
                          className={[
                            "bg-white rounded-2xl border shadow-sm overflow-hidden",
                            isCurrent ? "border-sky-200" : "border-slate-200",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-4 px-4 py-4">
                            {/* Term icon */}
                            <div
                              className={[
                                "h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0",
                                isCurrent
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-slate-100 text-slate-600",
                              ].join(" ")}
                            >
                              T{card.term}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-slate-800">
                                  {TERM_LABEL[card.term]}
                                </p>
                                {isCurrent && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-600 border border-sky-200">
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                {card.conduct_grade && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                      CONDUCT_COLOR[card.conduct_grade] ??
                                      "text-slate-600 bg-slate-50 border-slate-200"
                                    }`}
                                  >
                                    Conduct: {card.conduct_grade}
                                  </span>
                                )}
                                {card.effort_grade && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                      CONDUCT_COLOR[card.effort_grade] ??
                                      "text-slate-600 bg-slate-50 border-slate-200"
                                    }`}
                                  >
                                    Effort: {card.effort_grade}
                                  </span>
                                )}
                                {publishedDate && (
                                  <span className="text-[10px] text-slate-400">
                                    Issued {publishedDate}
                                  </span>
                                )}
                              </div>
                              {card.class_teacher_remarks && (
                                <p className="text-[11px] text-slate-500 mt-1 italic line-clamp-1">
                                  "{card.class_teacher_remarks}"
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={getReportUrl(
                                  activeChildId,
                                  card.term,
                                  card.academic_year,
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`View Term ${card.term} report`}
                                className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-sky-100 hover:text-sky-600 flex items-center justify-center text-slate-500 transition-colors"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </a>
                              <a
                                href={getReportUrl(
                                  activeChildId,
                                  card.term,
                                  card.academic_year,
                                )}
                                download={`${activeChildName.replace(/\s+/g, "_")}_Term${card.term}_${card.academic_year}.pdf`}
                                aria-label={`Download Term ${card.term} report`}
                                className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-emerald-100 hover:text-emerald-600 flex items-center justify-center text-slate-500 transition-colors"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </>
        )}

        {/* Help note */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs text-slate-500 leading-relaxed">
            <span className="font-bold text-slate-700">View</span> opens the
            report card in a new tab — you can print directly from there.{" "}
            <span className="font-bold text-slate-700">Save</span> downloads a
            PDF copy to your device. If a term's report is missing, it may not
            have been published yet by the class teacher.
          </p>
        </div>
      </div>
    </div>
  );
}
