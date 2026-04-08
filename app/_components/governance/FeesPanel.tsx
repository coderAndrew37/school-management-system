"use client";

import { useState, useMemo } from "react";

import type { FeePayment, FeeStructure, StudentSummary } from "@/lib/types/governance";
import type { Class } from "@/lib/types/allocation";
import { FeesSummaryStrip } from "./FeesSummaryStrip";
import { PaymentLedger } from "./PaymentLedger";
import { FeeStructuresPanel } from "./FeesStructuresPanel";
import { cn } from "./fees.utils";

type SubTab = "ledger" | "structures";

interface Props {
  feeStructures: FeeStructure[];
  payments: FeePayment[];
  students: StudentSummary[];
  /** All classes for the current academic year — replaces the old ALL_GRADES list */
  classes: Class[];
}

export function FeesPanel({ feeStructures, payments, students, classes }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("ledger");

  const stats = useMemo(
    () => ({
      totalDue: payments.reduce((s, p) => s + p.amount_due, 0),
      totalPaid: payments.reduce((s, p) => s + p.amount_paid, 0),
      overdueCount: payments.filter((p) => p.status === "overdue").length,
    }),
    [payments],
  );

  return (
    <div className="space-y-5">
      <FeesSummaryStrip
        totalDue={stats.totalDue}
        totalPaid={stats.totalPaid}
        overdueCount={stats.overdueCount}
      />

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 w-fit rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
        {(["ledger", "structures"] as SubTab[]).map((t) => (
          <button
            key={t}
            aria-label={t === "ledger" ? "Switch to Payment Ledger" : "Switch to Fee Structures"}
            onClick={() => setSubTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
              subTab === t
                ? "bg-amber-400 text-[#0c0f1a]"
                : "text-white/50 hover:text-white",
            )}
          >
            {t === "ledger" ? "Payment Ledger" : "Fee Structures"}
          </button>
        ))}
      </div>

      {subTab === "ledger" && (
        <PaymentLedger payments={payments} students={students} />
      )}

      {subTab === "structures" && (
        <FeeStructuresPanel feeStructures={feeStructures} classes={classes} />
      )}
    </div>
  );
}