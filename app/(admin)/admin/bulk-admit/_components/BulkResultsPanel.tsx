// app/admin/bulk-admit/_components/BulkResultsPanel.tsx
"use client";

import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import type { BulkAdmitResult } from "@/lib/actions/bulk-admit";
import type { BulkTeacherResult } from "@/lib/actions/bulk-teacher";

interface Props {
  results: (BulkAdmitResult | BulkTeacherResult)[];
  summary: { success: number; failed: number };
}

export function BulkResultsPanel({ results, summary }: Props) {
  return (
    <div className="mt-8 bg-white/[0.04] border border-white/10 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">Import Results</h3>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-bold">{summary.success} Successful</span>
          </div>
          {summary.failed > 0 && (
            <div className="flex items-center gap-2 text-rose-400">
              <XCircle className="h-5 w-5" />
              <span className="font-bold">{summary.failed} Failed</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto space-y-2 pr-2">
        {results.map((result, index) => {
          const isSuccess = result.success;
          const name = "studentName" in result 
            ? result.studentName 
            : (result as BulkTeacherResult).fullName;

          return (
            <div
              key={index}
              className={`flex gap-4 items-start p-4 rounded-2xl border ${
                isSuccess 
                  ? "bg-emerald-500/10 border-emerald-500/20" 
                  : "bg-rose-500/10 border-rose-500/20"
              }`}
            >
              <div className="mt-0.5">
                {isSuccess ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{name}</p>
                <p className={`text-sm ${isSuccess ? "text-emerald-400" : "text-rose-400"}`}>
                  {result.message}
                </p>
              </div>

              <div className="text-xs font-mono text-white/40 self-center">
                #{index + 1}
              </div>
            </div>
          );
        })}
      </div>

      {summary.failed === 0 && (
        <div className="mt-6 text-center text-emerald-400 text-sm font-medium">
          All records processed successfully!
        </div>
      )}
    </div>
  );
}