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

// Status → .stat-card colour pairs
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

const METHOD_ICON: Record<PaymentMethod, React.ReactNode> = {
  mpesa: <Smartphone className="h-3.5 w-3.5" />,
  bank_transfer: <Building2 className="h-3.5 w-3.5" />,
  cash: <Banknote className="h-3.5 w-3.5" />,
  cheque: <FileX className="h-3.5 w-3.5" />,
  other: <CreditCard className="h-3.5 w-3.5" />,
};
const METHOD_LABEL: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

interface Props {
  payments: FeePayment[];
  childName: string;
  childGrade: string;
}

export function FeeStatusPanel({ payments, childName, childGrade }: Props) {
  const sorted = [...payments].sort((a, b) => a.term - b.term);
  const totalDue = payments.reduce((s, p) => s + Number(p.amount_due), 0);
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount_paid), 0);
  const balance = totalDue - totalPaid;
  const hasArrears = payments.some((p) =>
    ["overdue", "partial", "pending"].includes(p.status),
  );

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-center">
        <CreditCard className="h-8 w-8 text-slate-300 mb-3" />
        <p className="font-bold text-slate-500">No fee records yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Fee invoices will appear here once recorded by the school
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Summary strip — .stats-row .sc3 style ─────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            Total Due
          </p>
          <p className="text-base font-black text-slate-800 tabular-nums leading-tight">
            KES {totalDue.toLocaleString("en-KE")}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">
            Paid
          </p>
          <p className="text-base font-black text-emerald-700 tabular-nums leading-tight">
            KES {totalPaid.toLocaleString("en-KE")}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-4 py-4 text-center shadow-sm ${balance > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
        >
          <p
            className={`text-[10px] font-black uppercase tracking-wider mb-1 ${balance > 0 ? "text-red-600" : "text-emerald-600"}`}
          >
            Balance
          </p>
          <p
            className={`text-base font-black tabular-nums leading-tight ${balance > 0 ? "text-red-700" : "text-emerald-700"}`}
          >
            KES {Math.abs(balance).toLocaleString("en-KE")}
          </p>
        </div>
      </div>

      {/* ── Arrears alert ─────────────────────────────────────────────────── */}
      {hasArrears && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-red-700">
              Outstanding Balance
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Please contact the school office to arrange payment. Thank you.
            </p>
          </div>
        </div>
      )}

      {/* ── Per-term cards ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {sorted.map((p) => {
          const s = STATUS[p.status as PaymentStatus];
          const pct =
            p.amount_due > 0
              ? Math.min(
                  100,
                  (Number(p.amount_paid) / Number(p.amount_due)) * 100,
                )
              : 0;
          const balance = Number(p.amount_due) - Number(p.amount_paid);
          return (
            <div
              key={p.id}
              className={`rounded-2xl border ${s.border} ${s.bg} overflow-hidden shadow-sm`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
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
                    <p className="text-[10px] font-semibold text-slate-400">
                      {childGrade}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-black ${s.border} ${s.bg} ${s.text}`}
                >
                  {s.label}
                </span>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-3">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                    <span>
                      KES {Number(p.amount_paid).toLocaleString("en-KE")} paid
                    </span>
                    <span>
                      of KES {Number(p.amount_due).toLocaleString("en-KE")}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white border border-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
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

                {/* Meta row */}
                <div className="flex flex-wrap gap-3 text-[10px] font-semibold text-slate-500">
                  {p.payment_method && (
                    <span className="flex items-center gap-1">
                      {METHOD_ICON[p.payment_method as PaymentMethod]}
                      {METHOD_LABEL[p.payment_method as PaymentMethod]}
                    </span>
                  )}
                  {p.payment_date && (
                    <span>
                      {new Date(
                        p.payment_date + "T00:00:00",
                      ).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                  {p.reference_number && (
                    <span className="font-mono">Ref: {p.reference_number}</span>
                  )}
                  {balance > 0 && p.status !== "waived" && (
                    <span className={`font-black ${s.text}`}>
                      Bal: KES {balance.toLocaleString("en-KE")}
                    </span>
                  )}
                </div>

                {p.notes && (
                  <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-100 pt-2">
                    {p.notes}
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
