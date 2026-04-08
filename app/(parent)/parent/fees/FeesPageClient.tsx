"use client";

import { FeePayment, PaymentStatus } from "@/lib/types/governance";
import type { ChildWithAssessments } from "@/lib/types/parent";
import {
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  Receipt,
} from "lucide-react";

interface Props {
  feePayments: FeePayment[];
  child: ChildWithAssessments;
  allChildren: ChildWithAssessments[];
}

function formatKES(n: number) {
  return "KES " + n.toLocaleString("en-KE");
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  const styles: Record<
    PaymentStatus,
    { bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    paid: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    partial: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    pending: {
      bg: "bg-slate-50",
      text: "text-slate-600",
      border: "border-slate-200",
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    overdue: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
    waived: {
      bg: "bg-cyan-50",
      text: "text-cyan-700",
      border: "border-cyan-200",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-xl border ${s.bg} ${s.text} ${s.border}`}
    >
      {s.icon}
      {status}
    </span>
  );
}

export function FeesPageClient({ feePayments, child, allChildren }: Props) {
  // Logic updated for new amount_due / amount_paid structure
  const totalPaid = feePayments.reduce((s, f) => s + (f.amount_paid || 0), 0);
  const totalDue = feePayments.reduce((s, f) => s + (f.amount_due || 0), 0);
  const totalBalance = Math.max(0, totalDue - totalPaid);

  // Group by academic year
  const byYear = feePayments.reduce<Record<number, FeePayment[]>>((acc, f) => {
    (acc[f.academic_year] ??= []).push(f);
    return acc;
  }, {});

  const sortedYears = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Wallet className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">Fee Statement</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
              {child.full_name}
            </p>
          </div>
          {allChildren.length > 1 && (
            <div className="flex gap-1.5">
              {allChildren.map((c) => (
                <a
                  key={c.id}
                  href={`/parent/fees?child=${c.id}`}
                  className={`text-[10px] font-black px-3 py-1.5 rounded-lg border transition-all uppercase tracking-tighter ${
                    c.id === child.id
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {c.full_name.split(" ")[0]}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {feePayments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Receipt className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-bold">No fee history found</p>
          </div>
        ) : (
          <>
            {/* Summary Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
                  Total Paid
                </p>
                <p className="text-xl font-black text-emerald-600 tabular-nums">
                  {formatKES(totalPaid)}
                </p>
              </div>
              <div
                className={`rounded-2xl border p-5 shadow-sm bg-white ${totalBalance > 0 ? "border-rose-100" : "border-slate-200"}`}
              >
                <p
                  className={`text-[10px] font-black uppercase tracking-widest mb-1 ${totalBalance > 0 ? "text-rose-500" : "text-slate-400"}`}
                >
                  Total Balance
                </p>
                <p
                  className={`text-xl font-black tabular-nums ${totalBalance > 0 ? "text-rose-600" : "text-slate-400"}`}
                >
                  {formatKES(totalBalance)}
                </p>
              </div>
            </div>

            {/* Fee History */}
            {sortedYears.map((year) => (
              <div key={year} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Year {year}
                  </p>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <div className="space-y-3">
                  {byYear[year]
                    .sort((a, b) => b.term - a.term)
                    .map((f) => {
                      const bal = (f.amount_due || 0) - (f.amount_paid || 0);
                      return (
                        <div
                          key={f.id}
                          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-blue-200 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">
                                T{f.term}
                              </div>
                              <div>
                                <p className="text-sm font-black text-slate-800">
                                  Term {f.term} Fees
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">
                                  {child.current_grade}
                                </p>
                              </div>
                            </div>
                            <StatusBadge status={f.status} />
                          </div>

                          <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50 mb-3">
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase">
                                Amount Due
                              </p>
                              <p className="text-sm font-black text-slate-700">
                                {formatKES(f.amount_due)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase text-right">
                                Paid
                              </p>
                              <p className="text-sm font-black text-emerald-600 text-right">
                                {formatKES(f.amount_paid)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              {f.mpesa_code && (
                                <span className="text-[9px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                                  {f.mpesa_code}
                                </span>
                              )}
                              {f.paid_at && (
                                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  {new Date(f.paid_at).toLocaleDateString(
                                    "en-KE",
                                    { day: "numeric", month: "short" },
                                  )}
                                </span>
                              )}
                            </div>
                            {bal > 0 && f.status !== "waived" && (
                              <p className="text-[10px] font-black text-rose-600 italic">
                                Bal: {formatKES(bal)}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}

            {/* Support Box */}
            <div className="bg-slate-900 rounded-3xl p-6 text-center text-white shadow-xl shadow-blue-900/10">
              <p className="text-sm font-black uppercase tracking-widest mb-1">
                Billing Support
              </p>
              <p className="text-xs text-slate-400 mb-4">
                Have questions about your statement or need to pay?
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <a
                  href="tel:+254700000000"
                  className="bg-white text-slate-900 px-6 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-slate-100 transition-colors"
                >
                  Call Office
                </a>
                <a
                  href="mailto:finance@kibali.ac.ke"
                  className="bg-slate-800 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase hover:bg-slate-700 transition-colors"
                >
                  Email Bursar
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
