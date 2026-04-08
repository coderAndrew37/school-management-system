"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

import { upsertFeeStructureAction } from "@/lib/actions/governance";
import type { FeeStructure } from "@/lib/types/governance";
import type { Class } from "@/lib/types/allocation";
import { formatClassName } from "@/lib/types/allocation";
import { FeeStructureForm } from "./FeesStructureForm";
import { fmt } from "./fees.utils";
import type { FsValues } from "./fees.schemas";

interface Props {
  feeStructures: FeeStructure[];
  classes: Class[];
}

export function FeeStructuresPanel({ feeStructures, classes }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (values: FsValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("academic_year", "2026");
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      const res = await upsertFeeStructureAction(fd);
      if (res.success) {
        toast.success("Fee structure saved");
        setShowForm(false);
      } else {
        toast.error("Failed", { description: res.message });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-white/40">
          {feeStructures.length} fee structure{feeStructures.length !== 1 ? "s" : ""}
        </p>
        <button
          aria-label={showForm ? "Cancel fee structure" : "Add or update fee structure"}
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 px-4 py-2 text-xs font-bold text-[#0c0f1a] transition-all"
        >
          {showForm ? (
            <><X className="h-3.5 w-3.5" />Cancel</>
          ) : (
            <><Plus className="h-3.5 w-3.5" />Add / Update</>
          )}
        </button>
      </div>

      {showForm && (
        <FeeStructureForm
          classes={classes}
          isPending={isPending}
          onSubmit={handleSubmit}
        />
      )}

      <div className="rounded-2xl border border-white/[0.07] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[620px]">
          <thead className="bg-white/[0.04] border-b border-white/[0.07]">
            <tr>
              {["Class", "Term", "Tuition", "Activity", "Lunch", "Transport", "Other", "Total"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {feeStructures.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-white/30">
                  No fee structures configured
                </td>
              </tr>
            ) : (
              feeStructures.map((fs) => {
                const total =
                  fs.tuition_fee +
                  fs.activity_fee +
                  fs.lunch_fee +
                  fs.transport_fee +
                  fs.other_fee;
                const classLabel = formatClassName(fs.classes);

                return (
                  <tr key={fs.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{classLabel}</td>
                    <td className="px-4 py-3 text-white/60">Term {fs.term}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/70">{fmt(fs.tuition_fee)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/50">{fmt(fs.activity_fee)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/50">{fmt(fs.lunch_fee)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/50">{fmt(fs.transport_fee)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-white/50">{fmt(fs.other_fee)}</td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-amber-400">{fmt(total)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}