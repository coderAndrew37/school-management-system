"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileText,
  Loader2,
  Users,
  BookOpen,
  ChevronDown,
  Printer,
} from "lucide-react";
import type { ReportTerm } from "@/lib/types/reports";

interface ReportsClientProps {
  availableGrades: string[];
  studentCounts: Record<string, number>;
  totalStudents: number;
}

const TERMS: { value: ReportTerm; label: string }[] = [
  { value: 1, label: "Term One" },
  { value: 2, label: "Term Two" },
  { value: 3, label: "Term Three" },
];

const selectCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 appearance-none cursor-pointer disabled:opacity-50";

export function ReportsClient({
  availableGrades,
  studentCounts,
  totalStudents,
}: ReportsClientProps) {
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedTerm, setSelectedTerm] = useState<ReportTerm>(1);
  const [academicYear] = useState<number>(2026);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  const targetCount =
    selectedGrade === "all"
      ? totalStudents
      : (studentCounts[selectedGrade] ?? 0);
  const gradeLabel = selectedGrade === "all" ? "All Grades" : selectedGrade;
  const termLabel = TERMS.find((t) => t.value === selectedTerm)?.label ?? "";

  const handleGenerate = async () => {
    if (targetCount === 0) {
      toast.warning("No students found", {
        description: "There are no students matching your selection.",
      });
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading(
      `Generating ${targetCount} report card${targetCount !== 1 ? "s" : ""}…`,
      { description: `${gradeLabel} · ${termLabel} ${academicYear}` },
    );

    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: selectedGrade,
          term: selectedTerm,
          academic_year: academicYear,
          mode: "bulk",
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      // Trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = `Kibali_Reports_Term${selectedTerm}_${academicYear}_${gradeLabel.replace(/[\s\/]/g, "_")}.pdf`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const count = res.headers.get("X-Student-Count") ?? String(targetCount);
      toast.success("Reports Downloaded!", {
        id: toastId,
        description: `${count} report card${Number(count) !== 1 ? "s" : ""} saved as ${filename}`,
        duration: 7000,
        icon: "📄",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Generation Failed", {
        id: toastId,
        description: message,
        duration: 6000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Filter card ── */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 space-y-6">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Grade */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-amber-400/70 mb-2">
              <Users className="h-3.5 w-3.5 text-amber-400" />
              Grade / Class
            </label>
            <div className="relative">
              <select
                aria-label="grade"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className={selectCls}
                disabled={isGenerating}
              >
                <option value="all" className="bg-[#0c0f1a]">
                  All Grades ({totalStudents} students)
                </option>
                {availableGrades.map((g) => (
                  <option key={g} value={g} className="bg-[#0c0f1a]">
                    {g} ({studentCounts[g] ?? 0} students)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            </div>
          </div>

          {/* Term */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-amber-400/70 mb-2">
              <BookOpen className="h-3.5 w-3.5 text-amber-400" />
              Term
            </label>
            <div className="relative">
              <select
                aria-label="term"
                value={selectedTerm}
                onChange={(e) =>
                  setSelectedTerm(Number(e.target.value) as ReportTerm)
                }
                className={selectCls}
                disabled={isGenerating}
              >
                {TERMS.map((t) => (
                  <option
                    key={t.value}
                    value={t.value}
                    className="bg-[#0c0f1a]"
                  >
                    {t.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            </div>
          </div>

          {/* Academic year — display only */}
          <div>
            <label className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-amber-400/70 mb-2">
              <FileText className="h-3.5 w-3.5 text-amber-400" />
              Academic Year
            </label>
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-mono text-white/60">
              {academicYear}
            </div>
          </div>
        </div>

        {/* Preview strip */}
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15 border border-amber-400/25">
              <FileText className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {targetCount === 0
                  ? "No students match"
                  : `${targetCount} Report Card${targetCount !== 1 ? "s" : ""}`}
              </p>
              <p className="text-xs text-white/40">
                {gradeLabel} · {termLabel} · {academicYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/30">
            <Printer className="h-3.5 w-3.5" />
            <span>PDF · A4 · Print-ready</span>
          </div>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || targetCount === 0}
          className="group relative w-full overflow-hidden rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 px-6 py-4 text-sm font-bold text-[#0c0f1a] flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating {targetCount} report{targetCount !== 1 ? "s" : ""}…
            </>
          ) : (
            <>
              <Download className="h-5 w-5" />
              Download {targetCount > 0 ? `${targetCount} ` : ""}Report Card
              {targetCount !== 1 ? "s" : ""} as PDF
            </>
          )}
          <span className="absolute inset-0 -skew-x-12 translate-x-[-200%] bg-white/20 transition-transform duration-500 group-hover:translate-x-[200%]" />
        </button>
      </div>

      {/* ── How it works ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: "🎯",
            title: "Filter",
            desc: "Select a grade (or all) and the term to generate reports for.",
          },
          {
            icon: "⚙️",
            title: "Generate",
            desc: "Reports are built server-side with student details and CBC assessment scores.",
          },
          {
            icon: "📥",
            title: "Download",
            desc: "A single merged PDF is downloaded — one page per student, ready to print.",
          },
        ].map(({ icon, title, desc }) => (
          <div
            key={title}
            className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-4"
          >
            <p className="text-2xl mb-2">{icon}</p>
            <p className="text-sm font-semibold text-white mb-1">{title}</p>
            <p className="text-xs text-white/40 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>

      {/* ── Grade breakdown table ── */}
      {availableGrades.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
          <div className="bg-white/[0.04] px-5 py-3 border-b border-white/[0.07]">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Students by Grade
            </p>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {availableGrades.map((grade) => {
              const count = studentCounts[grade] ?? 0;
              const pct = totalStudents > 0 ? (count / totalStudents) * 100 : 0;
              return (
                <div
                  key={grade}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors group"
                >
                  <span className="text-sm text-white/80 w-36 flex-shrink-0">
                    {grade}
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400/60 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-white/40 w-20 text-right flex-shrink-0">
                    {count} student{count !== 1 ? "s" : ""}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedGrade(grade);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="text-[10px] font-semibold text-amber-400/0 group-hover:text-amber-400/70 transition-colors uppercase tracking-wider flex-shrink-0"
                  >
                    Select →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
