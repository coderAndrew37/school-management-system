// app/teacher/_components/ClassGradeSelector.tsx
// Shown when a teacher is assigned to multiple grades and no ?grade= param is present.
// Renders a card picker that navigates to ?grade=X.
"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";

interface Props {
  grades: string[];
  currentPath: string; // e.g. "/teacher/class/reports"
}

export function ClassGradeSelector({ grades, currentPath }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 border border-emerald-200 mb-3">
            <Users className="h-6 w-6 text-emerald-700" />
          </div>
          <h1 className="text-lg font-black text-slate-800">Select a Class</h1>
          <p className="text-sm text-slate-500 mt-1">
            You are class teacher for {grades.length} grades. Choose which class
            to view.
          </p>
        </div>
        <div className="space-y-2">
          {grades.map((grade) => (
            <button
              key={grade}
              onClick={() =>
                router.push(`${currentPath}?grade=${encodeURIComponent(grade)}`)
              }
              className="w-full flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 transition-all text-left group"
            >
              <span className="text-sm font-bold text-slate-800">{grade}</span>
              <span className="text-[10px] font-bold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                Open →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
