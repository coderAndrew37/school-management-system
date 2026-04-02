"use client";

import { saveHistoricalOverrideAction } from "@/lib/actions/knec";
import type { KPSEAStudentRow } from "@/types/knec";
import { KPSEA_AREAS } from "@/types/knec";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  BookOpen,
  Loader2,
  Save,
  School,
  X,
} from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// ── Which year needs overriding ───────────────────────────────────────────────
type MissingYear = "g4" | "g5";

interface Props {
  student: KPSEAStudentRow;
  year: MissingYear;
  g6Year: number; // e.g. 2026
  onClose: () => void;
  onSaved: () => void; // triggers parent refetch / router.refresh()
}

// ── Form schema ───────────────────────────────────────────────────────────────
const areaSchema = z.object({
  pct: z.number().min(0, "Min 0").max(100, "Max 100"),
});

const overrideSchema = z.object({
  sourceSchool: z.string().min(1, "School name required"),
  notes: z.string().optional(),
  areas: z.record(z.string(), areaSchema),
});

type OverrideFormValues = z.infer<typeof overrideSchema>;

// ── Input style ───────────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-sky-400/40 focus:ring-2 focus:ring-sky-400/15 transition-all";

// ── Component ─────────────────────────────────────────────────────────────────
export function ManualOverrideModal({
  student,
  year,
  g6Year,
  onClose,
  onSaved,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const targetYear = year === "g4" ? g6Year - 2 : g6Year - 1;
  const gradeLabel = year === "g4" ? "Grade 4" : "Grade 5";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OverrideFormValues>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      sourceSchool: "",
      notes: "",
      areas: Object.fromEntries(
        KPSEA_AREAS.map((a) => [a, { pct: "" as unknown as number }]),
      ),
    },
  });

  const onSubmit = (values: OverrideFormValues) => {
    startTransition(async () => {
      // Save each area as a separate upsert (batched via sequential calls)
      const results = await Promise.all(
        KPSEA_AREAS.map((area) =>
          saveHistoricalOverrideAction({
            studentId: student.studentId,
            academicYear: targetYear,
            knecArea: area,
            avgPercentage: values.areas[area]?.pct ?? 0,
            sourceSchool: values.sourceSchool,
            notes: values.notes ?? "",
          }),
        ),
      );

      const failed = results.filter((r) => !r.success);
      if (failed.length > 0) {
        toast.error(failed[0]?.message ?? "Save failed");
        return;
      }

      toast.success(`${gradeLabel} data saved for ${student.fullName}`);
      onSaved();
      onClose();
    });
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-[#0d1117] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20">
              <BookOpen className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                Manual SBA Entry
              </h2>
              <p className="text-xs text-white/40 mt-0.5">
                {student.fullName} · {gradeLabel} ({targetYear})
              </p>
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-white/40 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Info banner */}
            <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80 leading-relaxed">
                Enter the <strong>average percentage</strong> per KPSEA area
                from this student's previous school records or paper register.
                These marks will be used in the cumulative SBA calculation
                (weighted as {gradeLabel} data).
              </p>
            </div>

            {/* Source school */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                <School className="h-3 w-3" />
                Previous School Name
              </label>
              <input
                placeholder="e.g. Nairobi Primary School"
                className={inputCls}
                {...register("sourceSchool")}
              />
              {errors.sourceSchool && (
                <p className="text-xs text-rose-400">
                  {errors.sourceSchool.message}
                </p>
              )}
            </div>

            {/* Per-area percentage inputs */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Average % per KPSEA Learning Area
              </p>
              <div className="grid grid-cols-1 gap-2">
                {KPSEA_AREAS.map((area) => (
                  <div
                    key={area}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5"
                  >
                    <p className="flex-1 text-sm font-semibold text-white/70">
                      {area}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        placeholder="0–100"
                        className="w-24 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-sm text-right text-white placeholder-white/20 outline-none focus:border-sky-400/40 focus:ring-1 focus:ring-sky-400/15 tabular-nums"
                        {...register(`areas.${area}.pct`, {
                          valueAsNumber: true,
                        })}
                      />
                      <span className="text-xs text-white/30">%</span>
                    </div>
                    {errors.areas?.[area]?.pct && (
                      <p className="text-[10px] text-rose-400">
                        {errors.areas[area]?.pct?.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Notes (optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Marks from end-of-year report card, Term 3 2024"
                className={`${inputCls} resize-none`}
                {...register("notes")}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.07] bg-white/[0.02]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 text-sm font-bold text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-5 py-2 text-sm font-bold text-white transition-all active:scale-95"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save {gradeLabel} Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
