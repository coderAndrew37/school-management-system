"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  ChevronDown,
  Pencil,
  Hash,
  Loader2,
  X,
  Save,
} from "lucide-react";
import type { KPSEAStudentRow, KPSEAReadinessStatus } from "@/types/knec";
import { KPSEA_AREAS } from "@/types/knec";
import {
  validateKPSEAData,
  downloadKPSEAExcel,
} from "@/lib/utils/kpsea-exporter";
import { ManualOverrideModal } from "./ManualOverrideModel";
import { saveAssessmentNumberAction } from "@/lib/actions/knec";

// ── Readiness badge ───────────────────────────────────────────────────────────
function ReadinessBadge({ status }: { status: KPSEAReadinessStatus }) {
  const cfg: Record<
    KPSEAReadinessStatus,
    { label: string; cls: string; icon: React.ReactNode }
  > = {
    ready: {
      label: "Ready",
      cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
    },
    missing_years: {
      label: "Missing Years",
      cls: "border-amber-400/30 bg-amber-400/10 text-amber-400",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    missing_assessment_number: {
      label: "No Assess. No.",
      cls: "border-rose-500/30 bg-rose-500/10 text-rose-400",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    missing_upi: {
      label: "No UPI",
      cls: "border-rose-500/30 bg-rose-500/10 text-rose-400",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
  };
  const c = cfg[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Year status cell ──────────────────────────────────────────────────────────
function YearCell({ status }: { status: "complete" | "missing" | "override" }) {
  if (status === "complete")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Done
      </span>
    );
  if (status === "override")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
        <Clock className="h-3 w-3" />
        Manual
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400">
      <AlertTriangle className="h-3 w-3" />
      Missing
    </span>
  );
}

// ── Assessment number inline editor ──────────────────────────────────────────
function AssessmentNumberEditor({
  studentId,
  current,
  onSaved,
}: {
  studentId: string;
  current: string | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current ?? "");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      const res = await saveAssessmentNumberAction(studentId, value);
      if (res.success) {
        toast.success(res.message);
        setEditing(false);
        onSaved();
      } else toast.error(res.message);
    });
  };

  if (!editing)
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-xs font-mono text-white/50 hover:text-amber-400 transition-colors group"
      >
        {current ? (
          <span className="text-amber-400/70">{current}</span>
        ) : (
          <span className="text-rose-400 font-bold">Set number</span>
        )}
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="Assessment No."
        className="w-28 rounded-lg border border-sky-400/40 bg-white/[0.06] px-2 py-1 text-xs font-mono text-white outline-none focus:ring-1 focus:ring-sky-400/30"
      />
      <button
        onClick={save}
        disabled={isPending}
        className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40"
      >
        {isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Save className="h-3 w-3" />
        )}
      </button>
      <button
        disabled={isPending}
        aria-label="close editing modal"
        onClick={() => setEditing(false)}
        className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.05] text-white/30 hover:text-white"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  rows: KPSEAStudentRow[];
  g6Year: number;
}

// ── Main component ────────────────────────────────────────────────────────────
export function KPSEAClient({ rows, g6Year }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    KPSEAReadinessStatus | "all"
  >("all");
  const [showScores, setShowScores] = useState(false);
  const [overrideModal, setOverrideModal] = useState<{
    student: KPSEAStudentRow;
    year: "g4" | "g5";
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const validation = validateKPSEAData(rows);

  const filtered = rows.filter((r) => {
    const matchSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.upiNumber ?? "").includes(search) ||
      (r.assessmentNumber ?? "").includes(search);
    const matchStatus =
      statusFilter === "all" || r.readinessStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const ready = rows.filter((r) => r.readinessStatus === "ready").length;
  const missing = rows.filter(
    (r) => r.readinessStatus === "missing_years",
  ).length;
  const noNum = rows.filter(
    (r) => r.readinessStatus === "missing_assessment_number",
  ).length;

  const handleDownload = () => {
    if (!validation.canExport) {
      toast.error("Fix all validation issues before exporting.");
      return;
    }
    startTransition(() => {
      try {
        downloadKPSEAExcel(rows, g6Year);
        toast.success("KPSEA SBA Excel downloaded.");
      } catch {
        toast.error("Export failed. Please try again.");
      }
    });
  };

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-6">
      {/* ── Validation banner ──────────────────────────────────────────────── */}
      {!validation.canExport && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4 space-y-2">
          <p className="text-xs font-bold text-amber-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Export blocked — resolve before downloading
          </p>
          {validation.missingAssessmentNumber.length > 0 && (
            <p className="text-xs text-amber-300/70">
              <span className="font-bold text-amber-300">
                Missing Assessment Number:
              </span>{" "}
              {validation.missingAssessmentNumber.join(", ")}
            </p>
          )}
          {validation.missingYears.map((m) => (
            <p key={m.fullName} className="text-xs text-amber-300/70">
              <span className="font-bold text-amber-300">{m.fullName}:</span>{" "}
              {m.missingGrades.join(", ")} SBA data missing — use the Manual
              Entry button to add it
            </p>
          ))}
        </div>
      )}

      {/* ── Stat strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", val: rows.length, color: "text-white" },
          { label: "Ready", val: ready, color: "text-emerald-400" },
          { label: "Missing Years", val: missing, color: "text-amber-400" },
          { label: "No Assess. No.", val: noNum, color: "text-rose-400" },
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
            placeholder="Search name, UPI or assessment number…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/20"
          />
        </div>

        <div className="relative">
          <select
            name="status"
            aria-label="filter by status readiness"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="appearance-none rounded-xl border border-white/10 bg-white/[0.04] pl-3 pr-8 py-2 text-xs font-bold text-white/60 outline-none focus:border-sky-400/40 cursor-pointer"
          >
            <option value="all">All status</option>
            <option value="ready">Ready</option>
            <option value="missing_years">Missing Years</option>
            <option value="missing_assessment_number">No Assess. No.</option>
            <option value="missing_upi">No UPI</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
        </div>

        <button
          onClick={() => setShowScores((v) => !v)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
            showScores
              ? "border-sky-400/30 bg-sky-400/10 text-sky-400"
              : "border-white/10 bg-white/[0.03] text-white/40 hover:text-white"
          }`}
        >
          {showScores ? "Hide" : "Show"} SBA scores
        </button>

        <button
          onClick={handleDownload}
          disabled={isPending || !validation.canExport}
          className="ml-auto flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 shadow-md shadow-emerald-500/20"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Download KPSEA Excel
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
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    Assess. No.
                  </span>
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-white/35">
                  G4
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-white/35">
                  G5
                </th>
                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-white/35">
                  G6
                </th>
                {showScores &&
                  KPSEA_AREAS.map((a) => (
                    <th
                      key={a}
                      className="px-2 py-3 text-center text-[9px] font-black uppercase tracking-wider text-white/30"
                    >
                      {a.split(" ")[0]}
                    </th>
                  ))}
                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-wider text-white/35">
                  SBA 60%
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/35">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider text-white/35">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9 + (showScores ? KPSEA_AREAS.length : 0)}
                    className="px-4 py-10 text-center text-sm text-white/30"
                  >
                    No students found
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.studentId}
                    className={`transition-colors hover:bg-white/[0.02] ${r.readinessStatus !== "ready" ? "bg-rose-500/[0.02]" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white text-sm">
                        {r.fullName}
                      </p>
                      <p className="text-[10px] font-mono text-white/30 mt-0.5">
                        {r.upiNumber ?? (
                          <span className="text-rose-400">No UPI</span>
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <AssessmentNumberEditor
                        studentId={r.studentId}
                        current={r.assessmentNumber}
                        onSaved={refresh}
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <YearCell status={r.historicalData.g4.status} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <YearCell status={r.historicalData.g5.status} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <YearCell status={r.historicalData.g6.status} />
                    </td>
                    {showScores &&
                      KPSEA_AREAS.map((a) => {
                        const score = r.scores.find((s) => s.area === a);
                        return (
                          <td key={a} className="px-2 py-3 text-center">
                            {score?.sba60 != null ? (
                              <span className="text-xs font-bold text-emerald-400 tabular-nums">
                                {score.sba60.toFixed(1)}
                              </span>
                            ) : (
                              <span className="text-xs text-rose-400">—</span>
                            )}
                          </td>
                        );
                      })}
                    <td className="px-3 py-3 text-center">
                      {r.totalSBA !== null ? (
                        <span className="text-sm font-black tabular-nums text-emerald-400">
                          {r.totalSBA.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-sm font-bold text-rose-400">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <ReadinessBadge status={r.readinessStatus} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        {r.historicalData.g4.status === "missing" && (
                          <button
                            onClick={() =>
                              setOverrideModal({ student: r, year: "g4" })
                            }
                            className="flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-1 text-[10px] font-bold text-amber-400 hover:bg-amber-400/15 transition-colors"
                          >
                            + G4 data
                          </button>
                        )}
                        {r.historicalData.g5.status === "missing" && (
                          <button
                            onClick={() =>
                              setOverrideModal({ student: r, year: "g5" })
                            }
                            className="flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-1 text-[10px] font-bold text-amber-400 hover:bg-amber-400/15 transition-colors"
                          >
                            + G5 data
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Manual Override Modal ─────────────────────────────────────────── */}
      {overrideModal && (
        <ManualOverrideModal
          student={overrideModal.student}
          year={overrideModal.year}
          g6Year={g6Year}
          onClose={() => setOverrideModal(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
