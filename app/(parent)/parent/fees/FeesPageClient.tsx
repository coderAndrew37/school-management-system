"use client";

import type { ChildWithAssessments } from "@/lib/types/parent";
import type { FeePayment } from "@/lib/data/parent";
import { Wallet, CheckCircle2, Clock, AlertCircle } from "lucide-react";

interface Props {
  feePayments: FeePayment[];
  child: ChildWithAssessments;
  children: ChildWithAssessments[];
}

function formatKES(n: number) {
  return "KES " + n.toLocaleString("en-KE");
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<
    string,
    { bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    paid: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    pending: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      icon: <Clock className="h-3.5 w-3.5" />,
    },
    overdue: {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl border ${s.bg} ${s.text} ${s.border}`}
    >
      {s.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function FeesPageClient({ feePayments, child, children }: Props) {
  const totalPaid = feePayments
    .filter((f) => f.status === "paid")
    .reduce((s, f) => s + f.amount, 0);
  const totalPending = feePayments
    .filter((f) => f.status === "pending" || f.status === "overdue")
    .reduce((s, f) => s + f.amount, 0);

  // Group by academic year
  const byYear = feePayments.reduce<Record<number, FeePayment[]>>((acc, f) => {
    (acc[f.academic_year] ??= []).push(f);
    return acc;
  }, {});
  const sortedYears = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Wallet className="h-5 w-5 text-blue-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">Fee Payments</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {child.full_name}
            </p>
          </div>
          {children.length > 1 && (
            <div className="flex gap-1.5">
              {children.map((c) => (
                <a
                  key={c.id}
                  href={`/parent/fees?child=${c.id}`}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    c.id === child.id
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  {c.full_name.split(" ")[0]}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {feePayments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">💳</p>
            <p className="text-slate-500 font-semibold">No fee records yet</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">
                  Total Paid
                </p>
                <p className="text-xl font-black text-emerald-700 tabular-nums">
                  {formatKES(totalPaid)}
                </p>
              </div>
              <div
                className={`rounded-2xl border p-4 shadow-sm ${totalPending > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}
              >
                <p
                  className={`text-[10px] font-black uppercase tracking-widest mb-1 ${totalPending > 0 ? "text-amber-500" : "text-slate-400"}`}
                >
                  Outstanding
                </p>
                <p
                  className={`text-xl font-black tabular-nums ${totalPending > 0 ? "text-amber-700" : "text-slate-400"}`}
                >
                  {formatKES(totalPending)}
                </p>
              </div>
            </div>

            {/* Fee records by year */}
            {sortedYears.map((year) => (
              <div key={year} className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                  Academic Year {year}
                </p>
                {byYear[year]
                  .sort((a, b) => a.term - b.term)
                  .map((f) => (
                    <div
                      key={f.id}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-4"
                    >
                      <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                        <p className="text-sm font-black text-blue-600">
                          T{f.term}
                        </p>
                        <p className="text-[8px] text-blue-400 font-bold">
                          {year}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800">
                          Term {f.term} Fees
                        </p>
                        <p className="text-xs font-black text-slate-600">
                          {formatKES(f.amount)}
                        </p>
                        {f.paid_at && (
                          <p className="text-[10px] text-slate-400">
                            Paid{" "}
                            {new Date(f.paid_at).toLocaleDateString("en-KE", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={f.status} />
                    </div>
                  ))}
              </div>
            ))}

            {/* Contact for payment */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
              <p className="text-sm font-bold text-blue-700">
                Need to make a payment?
              </p>
              <p className="text-xs text-blue-500 mt-1">
                Contact the school bursar
              </p>
              <a
                href="mailto:bursar@kibali.ac.ke"
                className="inline-block mt-2 text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
              >
                bursar@kibali.ac.ke
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
