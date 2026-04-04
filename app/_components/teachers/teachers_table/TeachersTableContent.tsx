"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown, Pencil } from "lucide-react";
import { TeacherAvatar } from "./TeacherAvatar";
import { STATUS_STYLE, STATUS_LABEL } from "./constants";
import type { Teacher } from "@/lib/types/dashboard";
import type { SortKey, SortDir } from "./useTeachersFilters";

interface TableContentProps {
  teachers: Teacher[];
  onEdit: (teacher: Teacher) => void;
  sortConfig: {
    key: SortKey;
    dir: SortDir;
    onSort: (key: SortKey) => void;
  };
}

const fmt = (dt: string) =>
  new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function TeachersTableContent({
  teachers,
  onEdit,
  sortConfig,
}: TableContentProps) {
  const COLS: { key: SortKey | null; label: string }[] = [
    { key: "full_name", label: "Teacher" },
    { key: "tsc_number", label: "TSC No." },
    { key: "email", label: "Email" },
    { key: null, label: "Phone" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Joined" },
    { key: null, label: "" },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/[0.07] bg-white/[0.03]">
            {COLS.map(({ key, label }) => (
              <th
                key={label}
                onClick={key ? () => sortConfig.onSort(key) : undefined}
                className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/30 ${key ? "cursor-pointer hover:text-white/60" : ""}`}
              >
                <span className="flex items-center gap-1.5">
                  {label}
                  {key &&
                    (sortConfig.key === key ? (
                      sortConfig.dir === "asc" ? (
                        <ChevronUp className="h-3 w-3 text-amber-400" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-amber-400" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 text-white/20" />
                    ))}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teachers.map((teacher, idx) => (
            <tr
              key={teacher.id}
              className={`border-b border-white/[0.04] last:border-0 transition-colors hover:bg-amber-400/[0.03] ${idx % 2 === 0 ? "bg-white/[0.01]" : ""} ${teacher.status !== "active" ? "opacity-60" : ""}`}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <TeacherAvatar teacher={teacher} />
                  <span className="font-medium text-white">
                    {teacher.full_name}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-emerald-400/80">
                {teacher.tsc_number || "Pending"}
              </td>
              <td className="px-4 py-3 text-white/55 text-xs truncate max-w-[150px]">
                {teacher.email}
              </td>
              <td className="px-4 py-3 font-mono text-xs text-white/50">
                {teacher.phone_number || "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${STATUS_STYLE[teacher.status]}`}
                >
                  {STATUS_LABEL[teacher.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-white/30 text-xs">
                {fmt(teacher.created_at)}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onEdit(teacher)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/50 hover:text-white transition-all"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
