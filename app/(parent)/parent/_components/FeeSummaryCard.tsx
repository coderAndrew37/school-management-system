import { ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";
import type { FeePayment } from "@/lib/types/governance";

interface Props {
  payments: FeePayment[];
}

export function FeeSummaryCard({ payments }: Props) {
  if (payments.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Wallet className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="text-sm font-black text-slate-800">
            Fee Statement Summary
          </p>
        </div>
        <Link
          href="/parent/fees"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          View full statement <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {payments.slice(0, 3).map((f) => {
          const isPaid = f.status.toLowerCase() === "paid";
          const isPending = f.status.toLowerCase() === "pending";

          return (
            <div
              key={f.id}
              className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                isPaid
                  ? "bg-emerald-50 border-emerald-100"
                  : isPending
                    ? "bg-amber-50 border-amber-100"
                    : "bg-rose-50 border-rose-100"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Term {f.term} • {f.academic_year}
                </p>
                <span
                  className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${
                    isPaid
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-white text-amber-700 border-amber-200"
                  }`}
                >
                  {f.status.toUpperCase()}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-lg font-black text-slate-800 leading-none">
                  KES {f.amount_paid.toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  {isPaid
                    ? "Total cleared"
                    : `Balance: KES ${(f.total_due - f.amount_paid).toLocaleString()}`}
                </p>
              </div>

              {!isPaid && (
                <div className="mt-3 h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{
                      width: `${Math.min((f.amount_paid / f.total_due) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}