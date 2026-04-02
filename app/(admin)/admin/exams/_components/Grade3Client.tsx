"use client";

import {
  downloadGrade3Excel,
  validateGrade3Data,
} from "@/lib/utils/excel-generator";
import type { Grade3StudentResult } from "@/types/knec";
import { GRADE3_LEARNING_AREAS } from "@/types/knec";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Info,
  Search,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// ── Rating pill ───────────────────────────────────────────────────────────────
function RatingPill({ rating }: { rating: number | undefined }) {
  if (rating === undefined)
    return (
      <span className="inline-flex items-center justify-center w-8 h-7 rounded-lg bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-black">
        —
      </span>
    );

  const style =
    rating === 4
      ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-300"
      : rating === 3
        ? "bg-sky-500/15     border-sky-500/25     text-sky-300"
        : rating === 2
          ? "bg-amber-500/15   border-amber-500/25   text-amber-300"
          : "bg-rose-500/15    border-rose-500/25    text-rose-400";
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-7 rounded-lg border text-xs font-black ${style}`}
    >
      {rating}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ result }: { result: Grade3StudentResult }) {
  const hasUpi = !result.issues.some((i) => i.type === "missing_upi");
  const missingAreas = result.issues.filter(
    (i) => i.type === "missing_area",
  ).length;

  if (!hasUpi)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-bold text-rose-400">
        <AlertTriangle className="h-3 w-3" />
        No UPI
      </span>
    );
  if (missingAreas > 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        {missingAreas} area{missingAreas !== 1 ? "s" : ""} missing
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
      <CheckCircle2 className="h-3 w-3" />
      Ready
    </span>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  results: Grade3StudentResult[];
  grade: string;
  year: number;
}

// ── Main client component ─────────────────────────────────────────────────────
export function Grade3Client({ results, grade, year }: Props) {
  const [search, setSearch] = useState("");
  const [showIssuesOnly, setIssuesOnly] = useState(false);
  const [expandedAreas, setExpandedAreas] = useState(false);
  const [isPending, startTransition] = useTransition();

  const validation = validateGrade3Data(results);

  const filtered = results.filter((r) => {
    const matchSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.upiNumber ?? "").includes(search);
    const matchIssue = !showIssuesOnly || r.issues.length > 0;
    return matchSearch && matchIssue;
  });

  const handleDownload = () => {
    if (!validation.canExport) {
      toast.error("Fix all validation issues before exporting.");
      return;
    }
    startTransition(() => {
      try {
        downloadGrade3Excel(results, year);
        toast.success("Grade 3 MLP Excel downloaded.");
      } catch {
        toast.error("Export failed. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Validation banner ──────────────────────────────────────────────── */}
      {!validation.canExport && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 space-y-2">
          <p className="text-xs font-bold text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Export blocked — fix the following before downloading
          </p>
          {validation.missingUpi.length > 0 && (
            <p className="text-xs text-amber-300/70">
              <span className="font-bold text-amber-300">Missing UPI:</span>{" "}
              {validation.missingUpi.join(", ")}
            </p>
          )}
          {validation.missingAreas.map((m) => (
            <p key={m.fullName} className="text-xs text-amber-300/70">
              <span className="font-bold text-amber-300">{m.fullName}:</span>{" "}
              missing {m.areas.join(", ")}
            </p>
          ))}
        </div>
      )}

      {/* ── Stat strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Students", val: results.length, color: "text-white" },
          {
            label: "Ready to Export",
            val: results.filter((r) => r.issues.length === 0).length,
            color: "text-emerald-400",
          },
          {
            label: "Need Attention",
            val: results.filter((r) => r.issues.length > 0).length,
            color: "text-amber-400",
          },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-center"
          >
            <p className={`text-2xl font-black tabular-nums ${color}`}>{val}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/30 mt-0.5">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or UPI…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/20"
          />
        </div>

        <button
          onClick={() => setIssuesOnly((v) => !v)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
            showIssuesOnly
              ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
              : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white"
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Issues only
        </button>

        <button
          onClick={() => setExpandedAreas((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-bold text-white/40 hover:text-white transition-all"
        >
          {expandedAreas ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
          {expandedAreas ? "Collapse" : "Show"} areas
        </button>

        <button
          onClick={handleDownload}
          disabled={isPending || !validation.canExport}
          className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 shadow-md shadow-emerald-500/20"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Download KNEC Excel
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/35">
                  Student
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/35">
                  UPI
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/35">
                  Gender
                </th>
                {expandedAreas &&
                  GRADE3_LEARNING_AREAS.map((a) => (
                    <th
                      key={a}
                      className="px-2 py-3 text-center text-[9px] font-black uppercase tracking-wider text-white/30 max-w-[60px]"
                    >
                      {a.split(" ")[0]}
                    </th>
                  ))}
                <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/35">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={
                      4 + (expandedAreas ? GRADE3_LEARNING_AREAS.length : 0)
                    }
                    className="px-4 py-10 text-center text-sm text-white/30"
                  >
                    No students found
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.studentId}
                    className={`transition-colors hover:bg-white/[0.02] ${r.issues.length > 0 ? "bg-rose-500/[0.03]" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white text-sm">
                        {r.fullName}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {r.upiNumber ? (
                        <span className="font-mono text-xs text-amber-400/70">
                          {r.upiNumber}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-rose-400">
                          MISSING
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-white/40">
                      {r.gender ?? "—"}
                    </td>
                    {expandedAreas &&
                      GRADE3_LEARNING_AREAS.map((a) => (
                        <td key={a} className="px-2 py-3 text-center">
                          <RatingPill rating={r.areas[a]} />
                        </td>
                      ))}
                    <td className="px-3 py-3">
                      <StatusBadge result={r} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 text-[10px] text-white/30">
        {([4, 3, 2, 1] as const).map((r) => (
          <span key={r} className="flex items-center gap-1.5">
            <RatingPill rating={r} />
            <span>
              = {r === 4 ? "EE" : r === 3 ? "ME" : r === 2 ? "AE" : "BE"}
            </span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <Info className="h-3 w-3" />
          Ratings 1-4 mapped to KNEC MLP scale
        </span>
      </div>
    </div>
  );
}
