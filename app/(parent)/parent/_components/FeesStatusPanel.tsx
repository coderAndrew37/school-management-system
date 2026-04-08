"use client";

import {
  CheckCircle2,
  AlertCircle,
  Clock,
  CreditCard,
  Smartphone,
  Banknote,
  Building2,
  FileX,
} from "lucide-react";
import type {
  FeePayment,
  PaymentStatus,
  PaymentMethod,
} from "@/lib/types/governance";

const STATUS: Record<
  PaymentStatus,
  {
    label: string;
    icon: React.ReactNode;
    border: string;
    bg: string;
    text: string;
    iconBg: string;
  }
> = {
  paid: {
    label: "Paid",
    icon: <CheckCircle2 className="h-4 w-4" />,
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    iconBg: "bg-emerald-100",
  },
  partial: {
    label: "Partial",
    icon: <Clock className="h-4 w-4" />,
    border: "border-amber-200",
    bg: "bg-amber-50",
    text: "text-amber-700",
    iconBg: "bg-amber-100",
  },
  pending: {
    label: "Pending",
    icon: <Clock className="h-4 w-4" />,
    border: "border-slate-200",
    bg: "bg-slate-50",
    text: "text-slate-600",
    iconBg: "bg-slate-100",
  },
  overdue: {
    label: "Overdue",
    icon: <AlertCircle className="h-4 w-4" />,
    border: "border-red-200",
    bg: "bg-red-50",
    text: "text-red-700",
    iconBg: "bg-red-100",
  },
  waived: {
    label: "Waived",
    icon: <CheckCircle2 className="h-4 w-4" />,
    border: "border-cyan-200",
    bg: "bg-cyan-50",
    text: "text-cyan-700",
    iconBg: "bg-cyan-100",
  },
};

const METHOD_ICON: Partial<Record<PaymentMethod, React.ReactNode>> = {
  mpesa: <Smartphone className="h-3.5 w-3.5" />,
  bank_transfer: <Building2 className="h-3.5 w-3.5" />,
  cash: <Banknote className="h-3.5 w-3.5" />,
  cheque: <FileX className="h-3.5 w-3.5" />,
  other: <CreditCard className="h-3.5 w-3.5" />,
};

const METHOD_LABEL: Partial<Record<PaymentMethod, string>> = {
  mpesa: "M-Pesa",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

interface Props {
  payments: FeePayment[];
  childName: string;
}

export function FeeStatusPanel({ payments, childName }: Props) {
  const sorted = [...payments].sort(
    (a, b) => b.academic_year - a.academic_year || b.term - a.term,
  );

  const totalDue = payments.reduce((s, p) => s + (Number(p.amount_due) || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (Number(p.amount_paid) || 0), 0);
  const totalBalance = totalDue - totalPaid;

  const hasArrears = payments.some(
    (p) =>
      ["overdue", "partial"].includes(p.status) &&
      (Number(p.amount_due) - Number(p.amount_paid)) > 0,
  );

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-center">
        <CreditCard className="h-8 w-8 text-slate-300 mb-3" />
        <p className="font-bold text-slate-500">No fee records for {childName}</p>
        <p className="text-xs text-slate-400 mt-1">
          Fee invoices will appear here once recorded by the school
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Total Due
          </p>
          <p className="text-sm md:text-base font-black text-slate-800 tabular-nums">
            KES {totalDue.toLocaleString("en-KE")}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">
            Paid
          </p>
          <p className="text-sm md:text-base font-black text-emerald-700 tabular-nums">
            KES {totalPaid.toLocaleString("en-KE")}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-4 py-4 text-center shadow-sm ${totalBalance > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
        >
          <p
            className={`text-[10px] font-black uppercase tracking-wider mb-1 ${totalBalance > 0 ? "text-red-600" : "text-emerald-600"}`}
          >
            Balance
          </p>
          <p
            className={`text-sm md:text-base font-black tabular-nums ${totalBalance > 0 ? "text-red-700" : "text-emerald-700"}`}
          >
            KES {Math.max(0, totalBalance).toLocaleString("en-KE")}
          </p>
        </div>
      </div>

      {hasArrears && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-red-700">
              Outstanding Balance
            </p>
            <p className="text-[11px] text-red-600 mt-0.5">
              Please contact the school office to arrange payment for {childName}.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((p) => {
          const s = STATUS[p.status] || STATUS.pending;
          const due = Number(p.amount_due) || 0;
          const paid = Number(p.amount_paid) || 0;
          const currentBalance = due - paid;
          const pct = due > 0 ? Math.min(100, (paid / due) * 100) : 0;

          // Resolve class info from the joined students.classes data
          const recordClass = p.students?.classes 
            ? `${p.students.classes.grade} ${p.students.classes.stream}` 
            : "General Fees";

          return (
            <div
              key={p.id}
              className={`rounded-2xl border ${s.border} ${s.bg} overflow-hidden shadow-sm`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/50">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.iconBg} ${s.text}`}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">
                      Term {p.term} · {p.academic_year}
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">
                      {recordClass}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${s.border} ${s.bg} ${s.text}`}
                >
                  {s.label}
                </span>
              </div>

              {/* Card Body */}
              <div className="px-4 py-3 space-y-3">
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                    <span>KES {paid.toLocaleString("en-KE")} paid</span>
                    <span>of KES {due.toLocaleString("en-KE")}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/60 border border-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        p.status === "paid" || p.status === "waived"
                          ? "bg-emerald-500"
                          : p.status === "overdue"
                            ? "bg-red-500"
                            : "bg-amber-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-semibold text-slate-500">
                  {p.payment_method && METHOD_LABEL[p.payment_method] && (
                    <span className="flex items-center gap-1">
                      {METHOD_ICON[p.payment_method]}
                      {METHOD_LABEL[p.payment_method]}
                    </span>
                  )}

                  {p.paid_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(p.paid_at).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}

                  {p.mpesa_code && (
                    <span className="font-mono text-slate-600 bg-white/50 px-1.5 rounded tracking-wider">
                      {p.mpesa_code}
                    </span>
                  )}

                  {currentBalance > 0 && p.status !== "waived" && (
                    <span className={`font-black ml-auto ${s.text}`}>
                      BAL: KES {currentBalance.toLocaleString("en-KE")}
                    </span>
                  )}
                </div>

                {p.notes && (
                  <p className="text-[11px] text-slate-500 leading-relaxed border-t border-black/5 pt-2 italic">
                    &quot;{p.notes}&quot;
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}