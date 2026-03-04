"use client";
// ─────────────────────────────────────────────────────────────────────────────
// components/admin/promotion/PromotionClient.tsx
// CBC end-of-year grade promotion tool.
//
// Features:
//   - Preview table: current grade → next grade, student counts
//   - Single-grade promotion with confirmation
//   - "Promote all grades" with full confirm dialog + live results log
//   - Terminal grade (Grade 9) shown with graduation badge
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  GraduationCap,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronUp,
  Trophy,
  Users,
  Zap,
  X,
} from "lucide-react";
import {
  promoteGradeAction,
  promoteAllGradesAction,
} from "@/lib/actions/promotion";
import type { GradeCount } from "@/lib/actions/promotion";

// ── Level colours ─────────────────────────────────────────────────────────────

const LEVEL_COLOR = (grade: string) => {
  if (["PP1", "PP2", "Grade 1", "Grade 2", "Grade 3"].includes(grade))
    return {
      text: "text-amber-400",
      badge: "bg-amber-400/10 border-amber-400/20 text-amber-400",
      level: "Lower Primary",
    };
  if (["Grade 4", "Grade 5", "Grade 6"].includes(grade))
    return {
      text: "text-sky-400",
      badge: "bg-sky-400/10   border-sky-400/20   text-sky-400",
      level: "Upper Primary",
    };
  return {
    text: "text-emerald-400",
    badge: "bg-emerald-400/10 border-emerald-400/20 text-emerald-400",
    level: "Junior Secondary",
  };
};

// ── Result log entry ──────────────────────────────────────────────────────────

interface LogEntry {
  success: boolean;
  message: string;
  fromGrade: string;
  toGrade: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialGrades: GradeCount[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PromotionClient({ initialGrades }: Props) {
  const [grades, setGrades] = useState<GradeCount[]>(initialGrades);
  const [confirmGrade, setConfirmGrade] = useState<GradeCount | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isPending, startTransition] = useTransition();

  const promotableGrades = grades.filter((g) => g.next !== null);
  const graduatingGrades = grades.filter((g) => g.next === null);

  // ── Single grade promotion ────────────────────────────────────────────────

  const handlePromoteSingle = (gradeCount: GradeCount) => {
    setConfirmGrade(gradeCount);
  };

  const confirmSingle = () => {
    if (!confirmGrade) return;
    setConfirmGrade(null);
    startTransition(async () => {
      const res = await promoteGradeAction(confirmGrade.grade);
      if (res.success) {
        toast.success("Grade promoted!", {
          description: res.message,
          icon: "🎓",
        });
        // Update local state
        setGrades((prev) =>
          prev
            .map((g) => {
              if (g.grade === confirmGrade.grade) return { ...g, count: 0 };
              if (g.grade === confirmGrade.next)
                return { ...g, count: g.count + confirmGrade.count };
              return g;
            })
            .filter((g) => g.count > 0),
        );
      } else {
        toast.error("Promotion failed", { description: res.message });
      }
    });
  };

  // ── Promote all ───────────────────────────────────────────────────────────

  const confirmPromoteAll = () => {
    setConfirmAll(false);
    startTransition(async () => {
      const results = await promoteAllGradesAction();
      const entries: LogEntry[] = results.map((r) => ({
        success: r.success,
        message: r.message,
        fromGrade: r.fromGrade ?? "",
        toGrade: r.toGrade ?? "",
      }));
      setLog(entries);

      const successCount = results.filter((r) => r.success).length;
      const totalStudents = results
        .filter((r) => r.success)
        .reduce((s, r) => s + (r.promoted ?? 0), 0);

      if (successCount === results.length) {
        toast.success("All grades promoted!", {
          description: `${totalStudents} students advanced across ${successCount} grades.`,
          icon: "🎉",
        });
        // Refresh grades to empty (all promoted)
        setGrades([]);
      } else {
        toast.warning("Partial promotion — check the results log below.");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Warning banner ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-400">
            This action is irreversible.
          </p>
          <p className="text-xs text-amber-400/70 mt-0.5">
            Grade promotion permanently updates student records. Run this only
            at end of academic year after all assessments and report cards have
            been generated. There is no automatic undo.
          </p>
        </div>
      </div>

      {/* ── Grade preview table ───────────────────────────────────────────── */}
      {grades.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <Trophy className="h-10 w-10 text-amber-400/40 mb-3" />
          <p className="text-white/50 font-medium">
            All grades promoted — no students remaining to advance.
          </p>
          <p className="text-white/25 text-sm mt-1">
            Refresh the page to verify the new grade distribution on the
            dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
            <div className="col-span-3">Current Grade</div>
            <div className="col-span-1 text-center">Students</div>
            <div className="col-span-1 text-center">→</div>
            <div className="col-span-4">Promoted To</div>
            <div className="col-span-3 text-right">Action</div>
          </div>

          {/* Promotable rows */}
          {promotableGrades.map((g) => {
            const fromColor = LEVEL_COLOR(g.grade);
            const toColor = g.next ? LEVEL_COLOR(g.next) : fromColor;

            return (
              <div
                key={g.grade}
                className="grid grid-cols-12 items-center rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] px-4 py-3.5 transition-colors gap-2"
              >
                {/* From grade */}
                <div className="col-span-3 flex items-center gap-2.5">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-lg border ${fromColor.badge}`}
                  >
                    {fromColor.level.split(" ")[0]}
                  </span>
                  <span className="font-medium text-white text-sm">
                    {g.grade}
                  </span>
                </div>

                {/* Count */}
                <div className="col-span-1 text-center">
                  <span className="flex items-center justify-center gap-1 text-sm font-bold text-white">
                    <Users className="h-3.5 w-3.5 text-white/30" />
                    {g.count}
                  </span>
                </div>

                {/* Arrow */}
                <div className="col-span-1 flex justify-center">
                  <ArrowRight className="h-4 w-4 text-white/20" />
                </div>

                {/* To grade */}
                <div className="col-span-4 flex items-center gap-2.5">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-lg border ${toColor.badge}`}
                  >
                    {toColor.level.split(" ")[0]}
                  </span>
                  <span className="font-medium text-white/70 text-sm">
                    {g.next}
                  </span>
                </div>

                {/* Action */}
                <div className="col-span-3 flex justify-end">
                  <button
                    onClick={() => handlePromoteSingle(g)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-400/8 hover:bg-amber-400/15 text-amber-400 px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40"
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5" />
                    )}
                    Promote
                  </button>
                </div>
              </div>
            );
          })}

          {/* Terminal / graduating rows */}
          {graduatingGrades.map((g) => {
            const col = LEVEL_COLOR(g.grade);
            return (
              <div
                key={g.grade}
                className="grid grid-cols-12 items-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.03] px-4 py-3.5 gap-2 opacity-70"
              >
                <div className="col-span-3 flex items-center gap-2.5">
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-lg border ${col.badge}`}
                  >
                    JSS
                  </span>
                  <span className="font-medium text-white text-sm">
                    {g.grade}
                  </span>
                </div>
                <div className="col-span-1 text-center">
                  <span className="text-sm font-bold text-emerald-400">
                    {g.count}
                  </span>
                </div>
                <div className="col-span-1" />
                <div className="col-span-4">
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400/70 font-medium">
                    <Trophy className="h-3.5 w-3.5" />
                    Ready to graduate
                  </span>
                </div>
                <div className="col-span-3 flex justify-end">
                  <span className="text-[10px] text-white/20 italic">
                    Terminal grade
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Promote all button ────────────────────────────────────────────── */}
      {promotableGrades.length > 0 && (
        <div className="flex justify-between items-center pt-2 border-t border-white/[0.06]">
          <div>
            <p className="text-sm font-semibold text-white">
              End-of-Year Promotion
            </p>
            <p className="text-xs text-white/35">
              Promote all {promotableGrades.length} grades simultaneously in the
              correct order
            </p>
          </div>
          <button
            onClick={() => setConfirmAll(true)}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 active:scale-95 px-5 py-2.5 text-sm font-bold text-[#0c0f1a] transition-all shadow-lg shadow-amber-400/20"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Promote All Grades
          </button>
        </div>
      )}

      {/* ── Results log ───────────────────────────────────────────────────── */}
      {log.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
              Promotion Results
            </p>
            <button
              aria-label="clear promo results log"
              onClick={() => setLog([])}
              className="text-white/25 hover:text-white/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {log.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                {entry.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose-400    flex-shrink-0 mt-0.5" />
                )}
                <p
                  className={`text-xs ${entry.success ? "text-emerald-400/80" : "text-rose-400/80"}`}
                >
                  {entry.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Single grade confirm dialog ───────────────────────────────────── */}
      {confirmGrade && (
        <ConfirmDialog
          title={`Promote ${confirmGrade.grade}?`}
          body={`This will move ${confirmGrade.count} student${confirmGrade.count !== 1 ? "s" : ""} from ${confirmGrade.grade} to ${confirmGrade.next}. This cannot be undone.`}
          confirmLabel="Yes, Promote Grade"
          onConfirm={confirmSingle}
          onCancel={() => setConfirmGrade(null)}
        />
      )}

      {/* ── Promote all confirm dialog ────────────────────────────────────── */}
      {confirmAll && (
        <ConfirmDialog
          title="Promote All Grades?"
          body={`This will advance all ${promotableGrades.reduce((s, g) => s + g.count, 0)} students across ${promotableGrades.length} grades simultaneously. All grade records will be permanently updated. Run this only after completing all Term 3 assessments and report cards.`}
          confirmLabel="Promote All Grades Now"
          danger
          onConfirm={confirmPromoteAll}
          onCancel={() => setConfirmAll(false)}
        />
      )}
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-400/20 bg-[#111827] p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white">{title}</p>
            <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
              {body}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
              danger
                ? "bg-rose-500 hover:bg-rose-400 text-white"
                : "bg-amber-400 hover:bg-amber-300 text-[#0c0f1a]"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
