"use client";

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
  Calendar,
} from "lucide-react";
import {
  promoteGradeAction,
  promoteAllGradesAction,
  graduateGradeAction,
} from "@/lib/actions/promotion";
import type { GradeCount, PromotionResult } from "@/lib/actions/promotion";
import ConfirmDialog from "./ConfirmDialog";

// ── Level colors (Derived from your CBC Levels) ──────────────────────────────

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
      badge: "bg-sky-400/10 border-sky-400/20 text-sky-400",
      level: "Upper Primary",
    };
  return {
    text: "text-emerald-400",
    badge: "bg-emerald-400/10 border-emerald-400/20 text-emerald-400",
    level: "Junior Secondary",
  };
};

interface Props {
  initialGrades: GradeCount[];
}

export function PromotionClient({ initialGrades }: Props) {
  const [grades, setGrades] = useState<GradeCount[]>(initialGrades);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear() + 1);
  const [confirmGrade, setConfirmGrade] = useState<GradeCount | null>(null);
  const [confirmGraduate, setConfirmGraduate] = useState<GradeCount | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [log, setLog] = useState<PromotionResult[]>([]);
  const [isPending, startTransition] = useTransition();

  const promotableGrades = grades.filter((g) => g.next !== null);
  const graduatingGrades = grades.filter((g) => g.next === null);

  // ── Single grade promotion ────────────────────────────────────────────────

  const confirmSingle = () => {
    if (!confirmGrade) return;
    const currentGrade = confirmGrade;
    setConfirmGrade(null);
    
    startTransition(async () => {
      const res = await promoteGradeAction(currentGrade.grade, targetYear);
      if (res.success) {
        toast.success(`Promoted ${currentGrade.grade}`, { description: res.message });
        refreshLocalState(currentGrade.grade, currentGrade.next, res.promoted || 0);
      } else {
        toast.error("Promotion failed", { description: res.message });
      }
    });
  };

  // ── Graduation ────────────────────────────────────────────────────────────

  const confirmGraduation = () => {
    if (!confirmGraduate) return;
    const currentGrade = confirmGraduate;
    setConfirmGraduate(null);

    startTransition(async () => {
      const res = await graduateGradeAction(currentGrade.grade);
      if (res.success) {
        toast.success("Graduation successful", { description: res.message });
        setGrades(prev => prev.filter(g => g.grade !== currentGrade.grade));
      } else {
        toast.error("Graduation failed", { description: res.message });
      }
    });
  };

  // ── Promote all ───────────────────────────────────────────────────────────

  const confirmPromoteAll = () => {
    setConfirmAll(false);
    startTransition(async () => {
      const results = await promoteAllGradesAction(targetYear);
      setLog(results);

      const hasFailures = results.some(r => !r.success || (r.errors && r.errors.length > 0));
      if (!hasFailures) {
        toast.success("All grades promoted!", { icon: "🎉" });
        setGrades([]); // Clear preview as everyone has moved
      } else {
        toast.warning("Promotion completed with warnings/errors. Check the log.");
      }
    });
  };

  const refreshLocalState = (from: string, to: string | null, count: number) => {
    setGrades((prev) =>
      prev
        .map((g) => {
          if (g.grade === from) return { ...g, count: Math.max(0, g.count - count) };
          if (g.grade === to) return { ...g, count: g.count + count };
          return g;
        })
        .filter((g) => g.count > 0)
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Configuration Row ─────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-400/10 flex items-center justify-center border border-amber-400/20">
            <Calendar className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Target Academic Year</p>
            <input 
            aria-label="Enter target year"
              type="number" 
              value={targetYear}
              onChange={(e) => setTargetYear(parseInt(e.target.value))}
              className="bg-transparent text-white font-bold text-lg focus:outline-none w-24"
            />
          </div>
        </div>

        <div className="rounded-xl bg-amber-400/[0.06] border border-amber-400/20 px-4 py-2 max-w-md">
          <p className="text-[11px] text-amber-400/80 leading-relaxed italic">
            Ensure classes for <strong>{targetYear}</strong> are created before promoting. 
            Students will be moved to the same stream in their new grade.
          </p>
        </div>
      </div>

      {/* ── Grade preview table ───────────────────────────────────────────── */}
      {grades.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <Trophy className="h-10 w-10 text-amber-400/40 mb-3" />
          <p className="text-white/50 font-medium">All students promoted or graduated.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
            <div className="col-span-3">Current Grade</div>
            <div className="col-span-1 text-center">Count</div>
            <div className="col-span-1 text-center">→</div>
            <div className="col-span-4">Promoted To</div>
            <div className="col-span-3 text-right">Action</div>
          </div>

          {promotableGrades.map((g) => {
            const fromColor = LEVEL_COLOR(g.grade);
            const toColor = g.next ? LEVEL_COLOR(g.next) : fromColor;

            return (
              <div key={g.grade} className="grid grid-cols-12 items-center rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] px-4 py-3.5 transition-colors gap-2">
                <div className="col-span-3 flex items-center gap-2.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${fromColor.badge}`}>
                    {fromColor.level}
                  </span>
                  <span className="font-medium text-white text-sm">{g.grade}</span>
                </div>

                <div className="col-span-1 text-center">
                  <span className="flex items-center justify-center gap-1 text-sm font-bold text-white">
                    <Users className="h-3 w-3 text-white/30" />
                    {g.count}
                  </span>
                </div>

                <div className="col-span-1 flex justify-center">
                  <ArrowRight className="h-4 w-4 text-white/20" />
                </div>

                <div className="col-span-4 flex items-center gap-2.5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${toColor.badge}`}>
                    {toColor.level}
                  </span>
                  <span className="font-medium text-white/70 text-sm">{g.next}</span>
                </div>

                <div className="col-span-3 flex justify-end">
                  <button
                    onClick={() => setConfirmGrade(g)}
                    disabled={isPending}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-400/8 hover:bg-amber-400/15 text-amber-400 px-3 py-1.5 text-xs font-semibold transition-all"
                  >
                    {isPending ? <Loader2 className="h-3 animate-spin" /> : <ChevronUp className="h-3" />}
                    Promote
                  </button>
                </div>
              </div>
            );
          })}

          {graduatingGrades.map((g) => (
            <div key={g.grade} className="grid grid-cols-12 items-center rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.03] px-4 py-3.5 gap-2">
              <div className="col-span-3 flex items-center gap-2.5">
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded border bg-emerald-400/10 border-emerald-400/20 text-emerald-400">Terminal</span>
                <span className="font-medium text-white text-sm">{g.grade}</span>
              </div>
              <div className="col-span-1 text-center font-bold text-emerald-400">{g.count}</div>
              <div className="col-span-1" />
              <div className="col-span-4 flex items-center gap-2 text-xs text-emerald-400/70">
                <GraduationCap className="h-4 w-4" /> Ready for Graduation
              </div>
              <div className="col-span-3 flex justify-end">
                <button
                  onClick={() => setConfirmGraduate(g)}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-400/25 bg-emerald-400/8 hover:bg-emerald-400/15 text-emerald-400 px-3 py-1.5 text-xs font-semibold transition-all"
                >
                  Graduate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Promote all button ────────────────────────────────────────────── */}
      {promotableGrades.length > 0 && (
        <div className="flex justify-between items-center pt-6 border-t border-white/[0.06]">
          <div className="flex items-start gap-3">
             <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5" />
             <div>
               <p className="text-sm font-semibold text-white">Bulk Year-End Promotion</p>
               <p className="text-xs text-white/35">Advances all grades in reverse sequence to prevent double-promotion.</p>
             </div>
          </div>
          <button
            onClick={() => setConfirmAll(true)}
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 px-6 py-3 text-sm font-bold text-[#0c0f1a] transition-all shadow-xl shadow-amber-400/10"
          >
            {isPending ? <Loader2 className="h-4 animate-spin" /> : <Zap className="h-4" />}
            Promote All to {targetYear}
          </button>
        </div>
      )}

      {/* ── Results log (Updated for stream errors) ─────────────────────────── */}
      {log.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Operation Log</p>
            <button aria-label="clear log" onClick={() => setLog([])} className="text-white/25 hover:text-white/60 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.04]">
            {log.map((entry, i) => (
              <div key={i} className="px-5 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  {entry.success ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-rose-400" />}
                  <p className={`text-xs font-medium ${entry.success ? "text-emerald-400" : "text-rose-400"}`}>{entry.message}</p>
                </div>
                {entry.errors && entry.errors.map((err, ei) => (
                  <p key={ei} className="text-[10px] text-white/40 pl-5 flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-rose-500/50" /> {err}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Confirmation Dialogs ─────────────────────────────────────────── */}
      {confirmGrade && (
        <ConfirmDialog
          title={`Promote ${confirmGrade.grade}?`}
          body={`Moving ${confirmGrade.count} students to ${confirmGrade.next} in academic year ${targetYear}.`}
          confirmLabel="Execute Promotion"
          onConfirm={confirmSingle}
          onCancel={() => setConfirmGrade(null)}
        />
      )}

      {confirmGraduate && (
        <ConfirmDialog
          title={`Graduate ${confirmGraduate.grade}?`}
          body={`This will mark ${confirmGraduate.count} active students as 'Graduated'. This status is terminal.`}
          confirmLabel="Mark as Graduated"
          onConfirm={confirmGraduation}
          onCancel={() => setConfirmGraduate(null)}
        />
      )}

      {confirmAll && (
        <ConfirmDialog
          title="Promote All Active Students?"
          body={`This will attempt to advance everyone to their respective next grades for the year ${targetYear}. Ensure all final report cards are generated before proceeding.`}
          confirmLabel="Start Bulk Promotion"
          danger
          onConfirm={confirmPromoteAll}
          onCancel={() => setConfirmAll(false)}
        />
      )}
    </div>
  );
}