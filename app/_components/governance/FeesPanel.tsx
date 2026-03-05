"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Banknote,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  ChevronDown,
  Receipt,
} from "lucide-react";

import {
  upsertFeeStructureAction,
  recordPaymentAction,
} from "@/lib/actions/governance";
import type {
  FeePayment,
  FeeStructure,
  PaymentStatus,
  StudentSummary,
  PaymentMethod,
} from "@/lib/types/governance";
import { ALL_GRADES } from "@/lib/types/allocation";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Utility for merging tailwind classes */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<
  PaymentStatus,
  { cls: string; icon: React.ReactNode; label: string }
> = {
  paid: {
    cls: "text-emerald-400 border-emerald-400/25 bg-emerald-400/10",
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "Paid",
  },
  partial: {
    cls: "text-amber-400   border-amber-400/25   bg-amber-400/10",
    icon: <Clock className="h-3 w-3" />,
    label: "Partial",
  },
  pending: {
    cls: "text-sky-400     border-sky-400/25     bg-sky-400/10",
    icon: <Clock className="h-3 w-3" />,
    label: "Pending",
  },
  overdue: {
    cls: "text-rose-400    border-rose-400/25    bg-rose-400/10",
    icon: <AlertCircle className="h-3 w-3" />,
    label: "Overdue",
  },
  waived: {
    cls: "text-white/40    border-white/10       bg-white/5",
    icon: null,
    label: "Waived",
  },
};

const fmt = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;

const fieldBase =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50";

// ── Schemas ───────────────────────────────────────────────────────────────────

const paySchema = z.object({
  student_id: z.string().min(1, "Student required"),
  term: z.coerce.number().int().min(1).max(3),
  amount_due: z.coerce.number().min(0),
  amount_paid: z.coerce.number().min(0),
  payment_method: z.enum(["mpesa", "bank_transfer", "cash", "cheque", "other"]),
  mpesa_code: z
    .string()
    .max(30)
    .optional()
    .transform((v) => v || ""),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => v || ""),
});
type PayValues = z.infer<typeof paySchema>;

const fsSchema = z.object({
  grade: z.string().min(1, "Grade required"),
  term: z.coerce.number().int().min(1).max(3),
  tuition_fee: z.coerce.number().min(0),
  activity_fee: z.coerce.number().min(0),
  lunch_fee: z.coerce.number().min(0),
  transport_fee: z.coerce.number().min(0),
  other_fee: z.coerce.number().min(0),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => v || ""),
});
type FsValues = z.infer<typeof fsSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  feeStructures: FeeStructure[];
  payments: FeePayment[];
  students: StudentSummary[];
}

export function FeesPanel({ feeStructures, payments, students }: Props) {
  const [subTab, setSubTab] = useState<"ledger" | "structures">("ledger");
  const [showPayForm, setShowPayForm] = useState(false);
  const [showFsForm, setShowFsForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | "all">(
    "all",
  );
  const [termFilter, setTermFilter] = useState<number | "all">("all");
  const [isPending, startTransition] = useTransition();

  // Payment form
  const payForm = useForm<PayValues>({
    resolver: zodResolver(paySchema),
    defaultValues: {
      term: 1,
      payment_method: "mpesa",
      amount_due: 0,
      amount_paid: 0,
      mpesa_code: "",
      notes: "",
    },
  });

  // Fee structure form
  const fsForm = useForm<FsValues>({
    resolver: zodResolver(fsSchema),
    defaultValues: {
      grade: ALL_GRADES[0],
      term: 1,
      tuition_fee: 0,
      activity_fee: 0,
      lunch_fee: 0,
      transport_fee: 0,
      other_fee: 0,
      notes: "",
    },
  });

  // ── Calculated State ───────────────────────────────────────────────────────
  const stats = useMemo(
    () => ({
      totalDue: payments.reduce((s, p) => s + p.amount_due, 0),
      totalPaid: payments.reduce((s, p) => s + p.amount_paid, 0),
      overdueN: payments.filter((p) => p.status === "overdue").length,
    }),
    [payments],
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        p.students?.full_name.toLowerCase().includes(q) ||
        (p.students?.readable_id ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchTerm = termFilter === "all" || p.term === termFilter;
      return matchSearch && matchStatus && matchTerm;
    });
  }, [payments, search, statusFilter, termFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onPayment = (values: PayValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("academic_year", "2026");
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      const res = await recordPaymentAction(fd);
      if (res.success) {
        toast.success("Payment recorded", { icon: "💳" });
        payForm.reset();
        setShowPayForm(false);
      } else {
        toast.error("Failed", { description: res.message });
      }
    });
  };

  const onFeeStructure = (values: FsValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("academic_year", "2026");
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      const res = await upsertFeeStructureAction(fd);
      if (res.success) {
        toast.success("Fee structure saved");
        fsForm.reset();
        setShowFsForm(false);
      } else {
        toast.error("Failed", { description: res.message });
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Due",
            value: fmt(stats.totalDue),
            color: "text-white",
          },
          {
            label: "Collected",
            value: fmt(stats.totalPaid),
            color: "text-emerald-400",
          },
          {
            label: "Outstanding",
            value: fmt(stats.totalDue - stats.totalPaid),
            color: "text-amber-400",
          },
          {
            label: "Overdue",
            value: String(stats.overdueN),
            color: "text-rose-400",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-center"
          >
            <p className={cn("text-lg font-bold tabular-nums", color)}>
              {value}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 w-fit rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
        {(["ledger", "structures"] as const).map((t) => (
          <button
            key={t}
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

      {/* ── Payment Ledger ──────────────────────────────────────────────────── */}
      {subTab === "ledger" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student…"
                className={cn(fieldBase, "pl-9")}
              />
            </div>
            <div className="relative">
              <select
                value={String(termFilter)}
                onChange={(e) =>
                  setTermFilter(
                    e.target.value === "all" ? "all" : Number(e.target.value),
                  )
                }
                className={cn(
                  fieldBase,
                  "appearance-none cursor-pointer min-w-[110px] pr-8",
                )}
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
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as PaymentStatus | "all")
                }
                className={cn(
                  fieldBase,
                  "appearance-none cursor-pointer min-w-[120px] pr-8",
                )}
              >
                <option value="all">All statuses</option>
                {(
                  [
                    "paid",
                    "partial",
                    "pending",
                    "overdue",
                    "waived",
                  ] as PaymentStatus[]
                ).map((s) => (
                  <option key={s} value={s} className="capitalize">
                    {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            </div>
            <button
              onClick={() => setShowPayForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 px-4 py-2.5 text-xs font-bold text-[#0c0f1a] transition-all flex-shrink-0"
            >
              {showPayForm ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Record Payment
                </>
              )}
            </button>
          </div>

          {/* Record payment form */}
          {showPayForm && (
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70 flex items-center gap-2 mb-4">
                <Receipt className="h-3.5 w-3.5" />
                Record Fee Payment
              </p>
              <form
                onSubmit={payForm.handleSubmit(onPayment)}
                noValidate
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    Student *
                  </label>
                  <div className="relative">
                    <select
                      className={cn(fieldBase, "appearance-none")}
                      {...payForm.register("student_id")}
                    >
                      <option value="">Select student…</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.current_grade})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  </div>
                  {payForm.formState.errors.student_id && (
                    <p className="mt-1 text-xs text-rose-400">
                      {payForm.formState.errors.student_id.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    Term *
                  </label>
                  <div className="relative">
                    <select
                      className={cn(fieldBase, "appearance-none")}
                      {...payForm.register("term")}
                    >
                      <option value={1}>Term 1</option>
                      <option value={2}>Term 2</option>
                      <option value={3}>Term 3</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    Amount Due (KES) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className={fieldBase}
                    {...payForm.register("amount_due")}
                  />
                  {payForm.formState.errors.amount_due && (
                    <p className="mt-1 text-xs text-rose-400">
                      {payForm.formState.errors.amount_due.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    Amount Paid (KES) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className={fieldBase}
                    {...payForm.register("amount_paid")}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    Payment method
                  </label>
                  <div className="relative">
                    <select
                      className={cn(fieldBase, "appearance-none")}
                      {...payForm.register("payment_method")}
                    >
                      <option value="mpesa">📱 M-Pesa</option>
                      <option value="bank_transfer">🏦 Bank Transfer</option>
                      <option value="cash">💵 Cash</option>
                      <option value="cheque">📄 Cheque</option>
                      <option value="other">Other</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    M-Pesa Code
                  </label>
                  <input
                    placeholder="Code"
                    className={cn(fieldBase, "font-mono")}
                    {...payForm.register("mpesa_code")}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    Notes
                  </label>
                  <input
                    placeholder="Optional notes"
                    className={fieldBase}
                    {...payForm.register("notes")}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition-all"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4" />
                    )}
                    Record Payment
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Payments table */}
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-white/[0.04] border-b border-white/[0.07]">
                <tr>
                  {[
                    "Student",
                    "Grade",
                    "Term",
                    "Due",
                    "Paid",
                    "Balance",
                    "Method",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-white/30"
                    >
                      No payments found
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const balance = p.amount_due - p.amount_paid;
                    const meta = STATUS_META[p.status];
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-white">
                            {p.students?.full_name ?? "—"}
                          </p>
                          {p.students?.readable_id && (
                            <p className="text-[10px] font-mono text-white/30">
                              {p.students.readable_id}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">
                          {p.students?.current_grade ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">
                          Term {p.term}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-white/60">
                          {fmt(p.amount_due)}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-emerald-400">
                          {fmt(p.amount_paid)}
                        </td>
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
      )}

      {/* ── Fee Structures ──────────────────────────────────────────────────── */}
      {subTab === "structures" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-white/40">
              {feeStructures.length} fee structure
              {feeStructures.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setShowFsForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 px-4 py-2 text-xs font-bold text-[#0c0f1a] transition-all"
            >
              {showFsForm ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Add / Update
                </>
              )}
            </button>
          </div>

          {showFsForm && (
            <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/70 flex items-center gap-2 mb-4">
                <Banknote className="h-3.5 w-3.5" />
                Fee Structure
              </p>
              <form
                onSubmit={fsForm.handleSubmit(onFeeStructure)}
                noValidate
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    Grade *
                  </label>
                  <div className="relative">
                    <select
                      className={cn(fieldBase, "appearance-none")}
                      {...fsForm.register("grade")}
                    >
                      {ALL_GRADES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    Term *
                  </label>
                  <div className="relative">
                    <select
                      className={cn(fieldBase, "appearance-none")}
                      {...fsForm.register("term")}
                    >
                      {[1, 2, 3].map((t) => (
                        <option key={t} value={t}>
                          Term {t}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  </div>
                </div>
                {[
                  { name: "tuition_fee", label: "Tuition (KES) *" },
                  { name: "activity_fee", label: "Activity Fee" },
                  { name: "lunch_fee", label: "Lunch Fee" },
                  { name: "transport_fee", label: "Transport Fee" },
                  { name: "other_fee", label: "Other Fee" },
                ].map((f) => (
                  <div key={f.name}>
                    <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                      {f.label}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className={fieldBase}
                      {...fsForm.register(f.name as any)}
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
                    Notes
                  </label>
                  <input
                    placeholder="Optional notes"
                    className={fieldBase}
                    {...fsForm.register("notes")}
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition-all"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote className="h-4 w-4" />
                    )}
                    Save Structure
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="rounded-2xl border border-white/[0.07] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[620px]">
              <thead className="bg-white/[0.04] border-b border-white/[0.07]">
                <tr>
                  {[
                    "Grade",
                    "Term",
                    "Tuition",
                    "Activity",
                    "Lunch",
                    "Transport",
                    "Other",
                    "Total",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {feeStructures.map((fs) => {
                  const total =
                    fs.tuition_fee +
                    fs.activity_fee +
                    fs.lunch_fee +
                    fs.transport_fee +
                    fs.other_fee;
                  return (
                    <tr
                      key={fs.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {fs.grade}
                      </td>
                      <td className="px-4 py-3 text-white/60">
                        Term {fs.term}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white/70">
                        {fmt(fs.tuition_fee)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white/50">
                        {fmt(fs.activity_fee)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white/50">
                        {fmt(fs.lunch_fee)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white/50">
                        {fmt(fs.transport_fee)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-white/50">
                        {fmt(fs.other_fee)}
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-bold text-amber-400">
                        {fmt(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
