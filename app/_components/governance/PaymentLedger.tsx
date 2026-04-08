"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X, Search, ChevronDown } from "lucide-react";

import { recordPaymentAction } from "@/lib/actions/governance";
import type { FeePayment, PaymentStatus, StudentSummary } from "@/lib/types/governance";
import { RecordPaymentForm } from "./RecordPaymentForm";
import { STATUS_META, cn, fieldBase, fmt } from "./fees.utils";
import type { PayValues } from "./fees.schemas";

interface Props {
  payments: FeePayment[];
  students: StudentSummary[];
}

export function PaymentLedger({ payments, students }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">("all");
  const [termFilter, setTermFilter] = useState<number | "all">("all");
  const [isPending, startTransition] = useTransition();

  const filtered = payments.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      p.students?.full_name.toLowerCase().includes(q) ||
      (p.students?.readable_id ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchTerm = termFilter === "all" || p.term === termFilter;
    return matchSearch && matchStatus && matchTerm;
  });

  const handleSubmit = (values: PayValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("academic_year", "2026");
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      const res = await recordPaymentAction(fd);
      if (res.success) {
        toast.success("Payment recorded", { icon: "💳" });
        setShowForm(false);
      } else {
        toast.error("Failed", { description: res.message });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
          <input
            aria-label="Search students"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student…"
            className={cn(fieldBase, "pl-9")}
          />
        </div>

        <div className="relative">
          <select
            aria-label="Filter by term"
            value={String(termFilter)}
            onChange={(e) =>
              setTermFilter(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className={cn(fieldBase, "appearance-none cursor-pointer min-w-[110px] pr-8")}
          >
            <option value="all">All terms</option>
            <option value="1">Term 1</option>
            <option value="2">Term 2</option>
            <option value="3">Term 3</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        </div>

        <div className="relative">
          <select
            aria-label="Filter by payment status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PaymentStatus | "all")}
            className={cn(fieldBase, "appearance-none cursor-pointer min-w-[120px] pr-8")}
          >
            <option value="all">All statuses</option>
            {(["paid", "partial", "pending", "overdue", "waived"] as PaymentStatus[]).map(
              (s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ),
            )}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        </div>

        <button
          aria-label={showForm ? "Cancel recording payment" : "Record new payment"}
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 px-4 py-2.5 text-xs font-bold text-[#0c0f1a] transition-all flex-shrink-0"
        >
          {showForm ? (
            <><X className="h-3.5 w-3.5" />Cancel</>
          ) : (
            <><Plus className="h-3.5 w-3.5" />Record Payment</>
          )}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <RecordPaymentForm
          students={students}
          isPending={isPending}
          onSubmit={handleSubmit}
        />
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-white/[0.04] border-b border-white/[0.07]">
            <tr>
              {["Student", "Class", "Term", "Due", "Paid", "Balance", "Method", "Status"].map(
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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-white/30">
                  No payments found
                </td>
              </tr>
            ) : (
              filtered.map((p) => {
                const balance = p.amount_due - p.amount_paid;
                const meta = STATUS_META[p.status];
                const classLabel = p.students?.classes
                  ? `${p.students.classes.grade}${p.students.classes.stream !== "Main" ? ` ${p.students.classes.stream}` : ""}`
                  : "—";

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{p.students?.full_name ?? "—"}</p>
                      {p.students?.readable_id && (
                        <p className="text-[10px] font-mono text-white/30">{p.students.readable_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{classLabel}</td>
                    <td className="px-4 py-3 text-xs text-white/50">Term {p.term}</td>
                    <td className="px-4 py-3 text-xs font-mono text-white/60">{fmt(p.amount_due)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-emerald-400">{fmt(p.amount_paid)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-amber-400">
                      {balance > 0 ? fmt(balance) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40 capitalize">
                      {(p.payment_method ?? "").replace("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                          meta.cls,
                        )}
                      >
                        {meta.icon}
                        {meta.label}
                      </span>
                    </td>
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