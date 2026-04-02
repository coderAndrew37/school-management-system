"use client";
// ============================================================
// components/admin/csl/CSLDashboard.tsx
// Admin view: class CSL summary table + per-student SBA grade
// ============================================================

import { reviewCSLEntryAction } from "@/lib/actions/csl";
import type {
  CSLStudentSummary,
  DbCSLEntry,
  SupervisorStatus,
} from "@/types/csl";
import { CSL_HOUR_TARGET } from "@/types/csl";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// ── SBA grade pill ────────────────────────────────────────────────────────────
function SBAGrade({ grade }: { grade: string }) {
  const cls =
    grade === "EE"
      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
      : grade === "ME"
        ? "bg-sky-500/15     border-sky-500/30     text-sky-300"
        : grade === "AE"
          ? "bg-amber-500/15   border-amber-500/30   text-amber-300"
          : "bg-rose-500/15    border-rose-500/30    text-rose-400";
  const label =
    grade === "EE"
      ? "Exceeds"
      : grade === "ME"
        ? "Meets"
        : grade === "AE"
          ? "Approaching"
          : "Below";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black ${cls}`}
    >
      {grade} · {label}
    </span>
  );
}

// ── Supervisor status badge ───────────────────────────────────────────────────
function StatusBadge({ status }: { status: SupervisorStatus }) {
  const cfg: Record<
    SupervisorStatus,
    { cls: string; icon: React.ReactNode; label: string }
  > = {
    pending: {
      cls: "border-white/10 bg-white/[0.04] text-white/40",
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
    },
    approved: {
      cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Approved",
    },
    rejected: {
      cls: "border-rose-500/30 bg-rose-500/10 text-rose-400",
      icon: <X className="h-3 w-3" />,
      label: "Rejected",
    },
  };
  const c = cfg[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${c.cls}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Hours bar ─────────────────────────────────────────────────────────────────
function HoursBar({ hours }: { hours: number }) {
  const pct = Math.min((hours / CSL_HOUR_TARGET) * 100, 100);
  const color =
    pct >= 100
      ? "bg-emerald-500"
      : pct >= 60
        ? "bg-sky-500"
        : pct >= 30
          ? "bg-amber-500"
          : "bg-rose-500";
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-bold tabular-nums text-white/50 w-10 text-right">
        {hours}/{CSL_HOUR_TARGET}h
      </span>
    </div>
  );
}

// ── Entry row with inline review ──────────────────────────────────────────────
function EntryRow({ entry }: { entry: DbCSLEntry }) {
  const [reviewing, setReviewing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const wordCount = entry.student_reflection
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const review = (status: "approved" | "rejected") => {
    const fd = new FormData();
    fd.append("entryId", entry.id);
    fd.append("status", status);
    fd.append("supervisorNotes", notes);
    startTransition(async () => {
      const res = await reviewCSLEntryAction(fd);
      if (res.success) {
        toast.success(res.message);
        setReviewing(false);
      } else toast.error(res.message);
    });
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">
            {entry.project_title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] font-bold text-purple-400/70 border border-purple-400/20 bg-purple-400/[0.06] rounded-full px-2 py-0.5">
              {entry.strand}
            </span>
            <span className="text-[10px] text-white/30">
              {entry.hours_spent}h
            </span>
            <StatusBadge status={entry.supervisor_status} />
          </div>
        </div>
        {entry.supervisor_status === "pending" && (
          <button
            onClick={() => setReviewing((v) => !v)}
            className="flex-shrink-0 rounded-lg border border-sky-400/25 bg-sky-400/[0.07] px-2.5 py-1 text-[10px] font-bold text-sky-400 hover:bg-sky-400/15 transition-colors"
          >
            Review
          </button>
        )}
      </div>

      <p className="text-xs text-white/40 leading-relaxed line-clamp-2">
        {entry.activity_description}
      </p>

      <div className="rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2 space-y-1">
        <p className="text-[9px] font-black uppercase tracking-widest text-white/25 flex items-center justify-between">
          Reflection{" "}
          <span
            className={wordCount >= 30 ? "text-emerald-400" : "text-amber-400"}
          >
            {wordCount}w
          </span>
        </p>
        <p className="text-[11px] text-white/50 leading-relaxed line-clamp-3">
          {entry.student_reflection}
        </p>
      </div>

      {entry.competencies_addressed.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.competencies_addressed.map((c) => (
            <span
              key={c}
              className="text-[9px] font-bold border border-white/[0.07] bg-white/[0.03] rounded-full px-2 py-0.5 text-white/35"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {/* Inline review form */}
      {reviewing && (
        <div className="pt-2 border-t border-white/[0.06] space-y-2">
          <textarea
            rows={2}
            placeholder="Supervisor notes (optional)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-sky-400/40 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => review("approved")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-3 py-1.5 text-xs font-bold hover:bg-emerald-500/25 disabled:opacity-50 transition-all"
            >
              {isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Approve
            </button>
            <button
              onClick={() => review("rejected")}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-1.5 text-xs font-bold hover:bg-rose-500/20 disabled:opacity-50 transition-all"
            >
              <X className="h-3 w-3" />
              Reject
            </button>
            <button
              onClick={() => setReviewing(false)}
              className="ml-auto text-xs text-white/25 hover:text-white px-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  summaries: CSLStudentSummary[];
  academicYear: number;
}

// ── Main component ────────────────────────────────────────────────────────────
export function CSLDashboard({ summaries, academicYear }: Props) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [expandedId, setExpanded] = useState<string | null>(null);

  const filtered = summaries.filter((s) => {
    const ms =
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (s.upiNumber ?? "").includes(search);
    const mg = gradeFilter === "all" || s.sbaGrade === gradeFilter;
    return ms && mg;
  });

  const stats = {
    ee: summaries.filter((s) => s.sbaGrade === "EE").length,
    me: summaries.filter((s) => s.sbaGrade === "ME").length,
    ae: summaries.filter((s) => s.sbaGrade === "AE").length,
    be: summaries.filter((s) => s.sbaGrade === "BE").length,
  };

  return (
    <div className="space-y-5">
      {/* ── Grade distribution ─────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2.5">
        {(
          [
            ["EE", "Exceeds", "emerald"],
            ["ME", "Meets", "sky"],
            ["AE", "Approaching", "amber"],
            ["BE", "Below", "rose"],
          ] as const
        ).map(([g, l, c]) => (
          <div
            key={g}
            className={`rounded-2xl border border-${c}-500/20 bg-${c}-500/[0.05] p-3.5 text-center cursor-pointer transition-all hover:-translate-y-0.5 ${gradeFilter === g ? `ring-1 ring-${c}-400/40` : ""}`}
            onClick={() => setGradeFilter(gradeFilter === g ? "all" : g)}
          >
            <p className={`text-2xl font-black text-${c}-400 tabular-nums`}>
              {stats[g.toLowerCase() as keyof typeof stats]}
            </p>
            <p
              className={`text-[10px] font-black uppercase tracking-wider text-${c}-400/60 mt-0.5`}
            >
              {g} · {l}
            </p>
          </div>
        ))}
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or UPI…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-sky-400/40"
          />
        </div>
        <p className="self-center text-xs text-white/30">
          {filtered.length} student{filtered.length !== 1 ? "s" : ""} · AY{" "}
          {academicYear}
        </p>
      </div>

      {/* ── Student rows ───────────────────────────────────────────────── */}
      <div className="space-y-2">
        {filtered.map((s) => {
          const isOpen = expandedId === s.studentId;
          return (
            <div
              key={s.studentId}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isOpen ? null : s.studentId)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                {/* Avatar */}
                <div className="h-9 w-9 rounded-xl bg-white/[0.07] border border-white/10 flex items-center justify-center text-xs font-black text-white/50 flex-shrink-0">
                  {s.fullName
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">
                    {s.fullName}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    {s.performance.summary}
                  </p>
                </div>
                <HoursBar hours={s.performance.totalHours} />
                <SBAGrade grade={s.sbaGrade} />
                <ChevronDown
                  className={`h-4 w-4 text-white/25 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-3">
                  {/* Performance detail */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      {
                        label: "Total Hours",
                        val: `${s.performance.totalHours}h`,
                        color: "text-white",
                      },
                      {
                        label: "Approved",
                        val: `${s.performance.approvedHours}h`,
                        color: "text-emerald-400",
                      },
                      {
                        label: "Entries",
                        val: `${s.performance.entryCount}`,
                        color: "text-sky-400",
                      },
                      {
                        label: "Avg Reflect.",
                        val: `${s.performance.avgReflectionWords}w`,
                        color: "text-purple-400",
                      },
                    ].map(({ label, val, color }) => (
                      <div
                        key={label}
                        className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 text-center"
                      >
                        <p
                          className={`text-base font-black tabular-nums ${color}`}
                        >
                          {val}
                        </p>
                        <p className="text-[9px] text-white/25 mt-0.5">
                          {label}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Logbook entries */}
                  {s.entries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
                      <BookOpen className="h-6 w-6 text-white/15 mx-auto mb-2" />
                      <p className="text-xs text-white/30">
                        No logbook entries yet
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {s.entries.map((entry) => (
                        <EntryRow key={entry.id} entry={entry} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
