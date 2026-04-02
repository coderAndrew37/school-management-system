"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Search,
  ChevronDown,
  BookOpen,
  TrendingUp,
  Info,
  Brain,
} from "lucide-react";
import type { IKESSCEResult, KESSCEReadiness, JSSSubject } from "@/types/knec";
import { JSS_CORE_SUBJECTS } from "@/types/knec";
import {
  validateKESSCEData,
  downloadKESSCEExcel,
} from "@/lib/utils/kessce-exporter";
import { getKESSCEReadiness } from "@/lib/utils/kessce-logic";

// ── Readiness badge ───────────────────────────────────────────────────────────

const READINESS_CFG: Record<
  KESSCEReadiness,
  {
    label: string;
    cls: string;
    icon: React.ReactNode;
  }
> = {
  ready: {
    label: "Ready",
    cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  counseling_required: {
    label: "Counseling Required",
    cls: "border-amber-400/30 bg-amber-400/10 text-amber-400",
    icon: <Brain className="h-3 w-3" />,
  },
  missing_data: {
    label: "Missing Data",
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  missing_upi: {
    label: "No UPI",
    cls: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

function ReadinessBadge({ status }: { status: KESSCEReadiness }) {
  const c = READINESS_CFG[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  pct,
  warn = false,
}: {
  pct: number | null;
  warn?: boolean;
}) {
  if (pct === null)
    return <span className="text-[10px] font-bold text-rose-400">—</span>;

  const color =
    warn && pct < 50
      ? "bg-rose-500"
      : pct >= 75
        ? "bg-emerald-500"
        : pct >= 50
          ? "bg-sky-500"
          : pct >= 25
            ? "bg-amber-500"
            : "bg-rose-500";

  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`text-[10px] font-bold tabular-nums w-9 text-right ${warn && pct < 50 ? "text-rose-400" : "text-white/60"}`}
      >
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// ── Expanded subject row ─────────────────────────────────────────────────────

function SubjectBreakdown({ result }: { result: IKESSCEResult }) {
  const isStem =
    result.pathway.pathwayCluster !== null &&
    [
      "Science & Technology",
      "Technical & Vocational",
      "Agriculture & Environment",
    ].includes(result.pathway.pathwayCluster);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 mt-3 border-t border-white/[0.06]">
      {JSS_CORE_SUBJECTS.map((subject) => {
        const sa = result.subjectAverages.find((s) => s.subject === subject);
        const warn =
          isStem &&
          (subject === "Mathematics" || subject === "Integrated Science");
        return (
          <div
            key={subject}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2"
          >
            <p className="text-[11px] font-semibold text-white/60 truncate flex-1">
              {subject}
            </p>
            <ScoreBar pct={sa?.avgPct ?? null} warn={warn} />
          </div>
        );
      })}
    </div>
  );
}

// ── Counseling panel ─────────────────────────────────────────────────────────

const REASON_LABEL: Record<string, string> = {
  math_below_threshold_for_stem: "Maths average below 50% for STEM pathway",
  science_below_threshold_for_stem:
    "Science average below 50% for STEM pathway",
  no_pathway_set: "No pathway cluster has been set",
  pathway_cluster_mismatch: "Performance does not match pathway recommendation",
};

function CounselingPanel({ result }: { result: IKESSCEResult }) {
  if (!result.counseling.required) return null;
  return (
    <div className="mt-3 pt-3 border-t border-amber-400/15 space-y-2">
      <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
        <Brain className="h-3 w-3" />
        Counseling Required
      </p>
      {result.counseling.reasons.map((r) => (
        <p key={r} className="text-xs text-amber-300/70 flex items-start gap-2">
          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
          {REASON_LABEL[r] ?? r}
        </p>
      ))}
    </div>
  );
}

// ── Learner profile drawer ────────────────────────────────────────────────────

function PathwayDrawer({ result }: { result: IKESSCEResult }) {
  const p = result.pathway;
  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">
            Pathway Cluster
          </p>
          <p className="text-xs font-bold text-white">
            {p.pathwayCluster ?? "—"}
          </p>
        </div>
        <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.04] p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-sky-400/60 mb-1">
            Senior School Track
          </p>
          <p className="text-xs font-bold text-sky-400">
            {p.seniorSchoolTrack ?? "Not set"}
          </p>
        </div>
      </div>

      {p.interestAreas.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1.5">
            Interest Areas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {p.interestAreas.map((i) => (
              <span
                key={i}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-semibold text-white/50"
              >
                {i}
              </span>
            ))}
          </div>
        </div>
      )}

      {p.careerInterests.length > 0 && (
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1.5">
            Career Aspirations
          </p>
          <div className="flex flex-wrap gap-1.5">
            {p.careerInterests.map((c) => (
              <span
                key={c}
                className="rounded-full border border-purple-400/20 bg-purple-400/[0.06] px-2.5 py-0.5 text-[10px] font-semibold text-purple-300/70"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">
          Learner Profile
        </p>
        <p className="text-[11px] text-white/55 leading-relaxed">
          {p.learnerProfile}
        </p>
      </div>

      {p.aiGuidance && (
        <div className="rounded-xl border border-purple-400/20 bg-purple-400/[0.05] p-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-purple-400/60 mb-1">
            AI Guidance
          </p>
          <p className="text-[11px] text-purple-300/70 leading-relaxed">
            {p.aiGuidance}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  results: IKESSCEResult[];
  g9Year: number;
}

// ── Main component ────────────────────────────────────────────────────────────

export function KESSCEClient({ results, g9Year }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<KESSCEReadiness | "all">(
    "all",
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showPathway, setShowPathway] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const validation = validateKESSCEData(results);

  const filtered = results.filter((r) => {
    const matchSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.upiNumber ?? "").includes(search);
    const status = getKESSCEReadiness(r);
    const matchStatus = statusFilter === "all" || status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: results.length,
    ready: results.filter((r) => getKESSCEReadiness(r) === "ready").length,
    counseling: results.filter((r) => r.counseling.required).length,
    missingData: results.filter((r) => getKESSCEReadiness(r) === "missing_data")
      .length,
    noUpi: results.filter((r) => !r.upiNumber).length,
  };

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const togglePathway = (id: string) =>
    setShowPathway((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const handleDownload = () => {
    if (!validation.canExport) {
      toast.error("Resolve blocking issues before exporting.");
      return;
    }
    startTransition(() => {
      try {
        downloadKESSCEExcel(results, g9Year);
        toast.success(
          `KESSCE Excel downloaded — ${validation.counselingRequired.length} student(s) flagged for counseling.`,
        );
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
            Export blocked — resolve before downloading
          </p>
          {validation.missingUpi.length > 0 && (
            <p className="text-xs text-amber-300/70">
              <span className="font-bold text-amber-300">Missing UPI:</span>{" "}
              {validation.missingUpi.join(", ")}
            </p>
          )}
          {validation.missingPathway.length > 0 && (
            <p className="text-xs text-amber-300/70">
              <span className="font-bold text-amber-300">No pathway set:</span>{" "}
              {validation.missingPathway.join(", ")}
            </p>
          )}
        </div>
      )}

      {/* Counseling info (non-blocking) */}
      {validation.counselingRequired.length > 0 && validation.canExport && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3 flex items-start gap-3">
          <Brain className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/70">
            <span className="font-bold text-amber-300">
              {validation.counselingRequired.length} student
              {validation.counselingRequired.length !== 1 ? "s" : ""} flagged
              for counseling
            </span>{" "}
            due to pathway/performance mismatch. Included in the Excel export as
            a separate sheet. They are <span className="font-bold">not</span>{" "}
            blocked from export.
          </p>
        </div>
      )}

      {/* ── Stat strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-2.5">
        {[
          { label: "Total", val: stats.total, color: "text-white" },
          { label: "Ready", val: stats.ready, color: "text-emerald-400" },
          {
            label: "Counseling",
            val: stats.counseling,
            color: "text-amber-400",
          },
          {
            label: "Missing Data",
            val: stats.missingData,
            color: "text-rose-400",
          },
          { label: "No UPI", val: stats.noUpi, color: "text-rose-400" },
        ].map(({ label, val, color }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-3 text-center"
          >
            <p className={`text-2xl font-black tabular-nums ${color}`}>{val}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-white/30 mt-0.5">
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

        <div className="relative">
          <select
            value={statusFilter}
            aria-label="filter by status"
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="appearance-none rounded-xl border border-white/10 bg-white/[0.04] pl-3 pr-8 py-2 text-xs font-bold text-white/60 outline-none focus:border-sky-400/40 cursor-pointer"
          >
            <option value="all">All status</option>
            <option value="ready">Ready</option>
            <option value="counseling_required">Counseling Required</option>
            <option value="missing_data">Missing Data</option>
            <option value="missing_upi">No UPI</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        </div>

        <button
          onClick={handleDownload}
          disabled={isPending || !validation.canExport}
          className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 shadow-md shadow-emerald-500/20"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Download KESSCE Excel
        </button>
      </div>

      {/* ── Student cards ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center">
          <p className="text-sm text-white/30">No students found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const readiness = getKESSCEReadiness(r);
            const isExpanded = expanded.has(r.studentId);
            const showPw = showPathway.has(r.studentId);
            const mathAvg = r.subjectAverages.find(
              (s) => s.subject === "Mathematics",
            )?.avgPct;
            const sciAvg = r.subjectAverages.find(
              (s) => s.subject === "Integrated Science",
            )?.avgPct;
            const isStem =
              r.pathway.pathwayCluster !== null &&
              [
                "Science & Technology",
                "Technical & Vocational",
                "Agriculture & Environment",
              ].includes(r.pathway.pathwayCluster);

            return (
              <div
                key={r.studentId}
                className={[
                  "rounded-2xl border overflow-hidden transition-all",
                  r.counseling.required
                    ? "border-amber-400/20 bg-amber-400/[0.03]"
                    : readiness === "ready"
                      ? "border-white/[0.07] bg-white/[0.02]"
                      : "border-rose-500/15 bg-rose-500/[0.02]",
                ].join(" ")}
              >
                {/* ── Card header ─────────────────────────────────────────── */}
                <div className="flex flex-wrap items-start gap-3 px-5 py-4">
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center text-sm font-black text-white/60 flex-shrink-0">
                    {r.fullName
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-bold text-white text-sm">
                        {r.fullName}
                      </p>
                      <ReadinessBadge status={readiness} />
                      {r.counseling.required && (
                        <span className="text-[9px] font-black text-amber-400/70 uppercase tracking-widest">
                          ⚠ Counseling
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-[10px] text-white/35">
                      {r.upiNumber ? (
                        <span className="font-mono text-amber-400/60">
                          {r.upiNumber}
                        </span>
                      ) : (
                        <span className="font-bold text-rose-400">No UPI</span>
                      )}
                      {r.gender && <span>{r.gender}</span>}
                      {r.overallAvgPct !== null && (
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3" />
                          Overall SBA:{" "}
                          <span className="font-black text-white/60">
                            {r.overallAvgPct}%
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Key scores for quick scan */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">
                        Maths
                      </p>
                      <ScoreBar pct={mathAvg ?? null} warn={isStem} />
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1">
                        Science
                      </p>
                      <ScoreBar pct={sciAvg ?? null} warn={isStem} />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => toggleExpand(r.studentId)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-all ${
                        isExpanded
                          ? "border-sky-400/30 bg-sky-400/10 text-sky-400"
                          : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white"
                      }`}
                    >
                      <BookOpen className="h-3 w-3" />
                      {isExpanded ? "Less" : "Subjects"}
                    </button>
                    <button
                      onClick={() => togglePathway(r.studentId)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition-all ${
                        showPw
                          ? "border-purple-400/30 bg-purple-400/10 text-purple-400"
                          : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white"
                      }`}
                    >
                      <Compass className="h-3 w-3" />
                      {showPw ? "Less" : "Pathway"}
                    </button>
                  </div>
                </div>

                {/* ── Expanded sections ────────────────────────────────────── */}
                {(isExpanded || showPw || r.counseling.required) && (
                  <div className="px-5 pb-5">
                    {isExpanded && <SubjectBreakdown result={r} />}
                    {showPw && <PathwayDrawer result={r} />}
                    {r.counseling.required && <CounselingPanel result={r} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
