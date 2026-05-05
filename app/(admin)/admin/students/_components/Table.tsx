// StudentsTableClient/_components/Table.tsx
"use client";

import type { Student, SortKey, SortDir } from "@/lib/types/dashboard";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";
import StudentAvatar from "./StudentAvatar";
import { fmt } from "@/app/_components/parents/parent-utils";
import { calcAge } from "@/lib/helpers/parent";

const STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-400",
  transferred: "text-amber-400",
  graduated: "text-sky-400",
  withdrawn: "text-rose-400",
};

interface TableProps {
  students: Student[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onEdit: (student: Student) => void;
}

export default function Table({ students, sortKey, sortDir, onSort, onEdit }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/[0.07] bg-white/[0.03]">
            {[
              { key: "full_name" as SortKey, label: "Student" },
              { key: "readable_id" as SortKey, label: "ID" },
              { key: "current_grade" as SortKey, label: "Grade/Stream" },
              { key: "gender" as SortKey, label: "Gender" },
              { key: "date_of_birth" as SortKey, label: "Age / DOB" },
              { key: null, label: "Parent" },
              { key: "created_at" as SortKey, label: "Admitted" },
              { key: null, label: "" },
            ].map(({ key, label }) => (
              <th
                key={label}
                onClick={key ? () => onSort(key) : undefined}
                className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/30 ${
                  key ? "cursor-pointer hover:text-white/60 select-none" : ""
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {label}
                  {key && sortKey === key && (
                    sortDir === "asc" ? (
                      <ChevronUp className="h-3 w-3 text-amber-400" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-amber-400" />
                    )
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student, idx) => (
            <tr
              key={student.id}
              className={`border-b border-white/[0.04] transition-colors hover:bg-amber-400/[0.03] ${
                idx % 2 === 0 ? "bg-white/[0.01]" : ""
              } ${student.status !== "active" ? "opacity-60" : ""}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <StudentAvatar student={student} />
                  <div>
                    <p className="font-medium text-white">{student.full_name}</p>
                    {student.status !== "active" && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLES[student.status] || "text-white/40"}`}>
                        {student.status}
                      </span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-amber-400/80">
                {student.readable_id ?? "—"}
              </td>
              <td className="px-4 py-3 text-white/70">
                <div className="flex items-center gap-2">
                  <span>{student.current_grade}</span>
                  <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-white/40">
                    {student.current_stream}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    student.gender === "Male"
                      ? "bg-sky-400/10 text-sky-400 border-sky-400/20"
                      : "bg-rose-400/10 text-rose-400 border-rose-400/20"
                  }`}
                >
                  {student.gender || "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-white/80">{calcAge(student.date_of_birth)} yrs</span>
              </td>
              <td className="px-4 py-3 text-white/60 text-xs">
                {student.parents?.full_name || "—"}
              </td>
              <td className="px-4 py-3 text-white/30 text-xs">
                {fmt(student.created_at)}
              </td>
              <td className="px-4 py-3">
                <button
                aria-label="edit student"
                  onClick={() => onEdit(student)}
                  className="p-2 rounded-lg border border-white/10 bg-white/[0.04] text-white/50 hover:text-white transition-all"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}