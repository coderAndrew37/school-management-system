// app/_components/communications/AudienceSelector.tsx

import type {
  AudienceSelection,
  CommunicationsClientProps,
} from "@/lib/types/communications";
import { Search } from "lucide-react";
import { useState } from "react";
import { AUDIENCE_OPTIONS } from "./constants";

interface Props {
  value: AudienceSelection;
  teachers: CommunicationsClientProps["recipients"]["teachers"];
  parents: CommunicationsClientProps["recipients"]["parents"];
  grades: string[];
  onChange: (v: AudienceSelection) => void;
}

export function AudienceSelector({
  value,
  teachers,
  parents,
  grades,
  onChange,
}: Props) {
  const [search, setSearch] = useState("");

  const needsIndividual =
    value.type === "single_teacher" || value.type === "single_parent";
  const needsGrade = value.type === "grade_parents";
  const pool = value.type === "single_teacher" ? teachers : parents;
  const filtered = search.trim()
    ? pool.filter(
        (p) =>
          p.full_name.toLowerCase().includes(search.toLowerCase()) ||
          p.email.toLowerCase().includes(search.toLowerCase()),
      )
    : pool;

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-white/35">
        Audience
      </label>

      <div className="grid grid-cols-2 gap-2">
        {AUDIENCE_OPTIONS.map((opt) => {
          const active = value.type === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => {
                onChange({ type: opt.type, individual: null, grade: null });
                setSearch("");
              }}
              className={[
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all",
                active
                  ? "bg-amber-400/10 border-amber-400/30 shadow-sm shadow-amber-400/10"
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]",
              ].join(" ")}
            >
              <span
                className={`mt-0.5 shrink-0 ${active ? "text-amber-400" : "text-white/25"}`}
              >
                {opt.icon}
              </span>
              <div>
                <p
                  className={`text-xs font-semibold leading-tight ${active ? "text-amber-400" : "text-white/55"}`}
                >
                  {opt.label}
                </p>
                <p className="text-[10px] text-white/20 mt-0.5">
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {needsIndividual && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="relative border-b border-white/[0.05]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${value.type === "single_teacher" ? "teachers" : "parents"}…`}
              className="w-full bg-transparent pl-8 pr-4 py-2.5 text-sm text-white placeholder-white/15 outline-none"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-4">
                No results
              </p>
            ) : (
              filtered.map((p) => {
                const isSelected = value.individual?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChange({ ...value, individual: p })}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-amber-400/10 text-amber-400"
                        : "text-white/50 hover:bg-white/[0.04] hover:text-white/75"
                    }`}
                  >
                    <span className="text-xs font-medium">{p.full_name}</span>
                    <span className="text-[10px] text-white/25 font-mono truncate max-w-[160px]">
                      {p.email}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {needsGrade && (
        <div className="flex flex-wrap gap-2">
          {grades.map((grade) => {
            const active = value.grade === grade;
            return (
              <button
                key={grade}
                type="button"
                onClick={() => onChange({ ...value, grade })}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all",
                  active
                    ? "bg-amber-400/15 border-amber-400/35 text-amber-400"
                    : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:text-white/65 hover:border-white/[0.14]",
                ].join(" ")}
              >
                {grade}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}