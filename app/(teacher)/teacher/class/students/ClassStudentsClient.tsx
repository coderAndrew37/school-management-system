"use client";

import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StudentWithStats } from "./types";

interface Props {
  students: StudentWithStats[];
  grade: string;
  academicYear: number;
}

function calcAge(dob: string) {
  const b = new Date(dob),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (
    n.getMonth() < b.getMonth() ||
    (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())
  )
    a--;
  return a;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function AttRatePill({ rate }: { rate: number }) {
  if (rate === 0)
    return (
      <span className="text-[10px] font-bold text-slate-400">No data</span>
    );
  const cls =
    rate >= 90
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : rate >= 75
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-rose-600 bg-rose-50 border-rose-200";
  return (
    <span
      className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${cls}`}
    >
      {rate}%
    </span>
  );
}

type SortKey = "name" | "attendance" | "assessments";

export function ClassStudentsClient({ students, grade, academicYear }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "at_risk" | "male" | "female">(
    "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Derived stats
  const totalPresent = students.reduce((s, st) => s + st.present, 0);
  const totalDays = students.reduce((s, st) => s + st.total_days, 0);
  const classRate =
    totalDays > 0 ? Math.round((totalPresent / totalDays) * 100) : null;
  const atRisk = students.filter(
    (s) => s.total_days > 0 && s.attendance_rate < 75,
  ).length;
  const notAssessed = students.filter((s) => s.assessment_count === 0).length;

  // Filter
  const filtered = students.filter((s) => {
    if (search && !s.full_name.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filter === "at_risk" && (s.total_days === 0 || s.attendance_rate >= 75))
      return false;
    if (filter === "male" && s.gender !== "Male") return false;
    if (filter === "female" && s.gender !== "Female") return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let v = 0;
    if (sortKey === "name") v = a.full_name.localeCompare(b.full_name);
    else if (sortKey === "attendance")
      v = a.attendance_rate - b.attendance_rate;
    else if (sortKey === "assessments")
      v = a.assessment_count - b.assessment_count;
    return sortAsc ? v : -v;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k)
      return <ChevronDown className="h-3 w-3 text-slate-300" />;
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 text-slate-500" />
    ) : (
      <ChevronDown className="h-3 w-3 text-slate-500" />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/teacher"
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown className="h-5 w-5 rotate-90" />
          </Link>
          <Users className="h-5 w-5 text-sky-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">
              My Class · {grade}
            </p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {students.length} students · {academicYear}
            </p>
          </div>
          <Link
            href="/teacher/class/reports"
            className="text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-xl transition-colors"
          >
            Reports →
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Class overview cards */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm text-center">
            <p className="text-2xl font-black text-slate-800">
              {students.length}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
              Students
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 shadow-sm text-center ${
              classRate !== null && classRate < 80
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-slate-200"
            }`}
          >
            <p
              className={`text-2xl font-black ${classRate !== null && classRate < 80 ? "text-amber-700" : "text-slate-800"}`}
            >
              {classRate !== null ? `${classRate}%` : "—"}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
              Attendance
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 shadow-sm text-center ${atRisk > 0 ? "bg-rose-50 border-rose-200" : "bg-white border-slate-200"}`}
          >
            <p
              className={`text-2xl font-black ${atRisk > 0 ? "text-rose-600" : "text-slate-800"}`}
            >
              {atRisk}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
              At Risk
            </p>
          </div>
          <div
            className={`rounded-2xl border p-3.5 shadow-sm text-center ${notAssessed > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}
          >
            <p
              className={`text-2xl font-black ${notAssessed > 0 ? "text-amber-600" : "text-slate-800"}`}
            >
              {notAssessed}
            </p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">
              Not Assessed
            </p>
          </div>
        </div>

        {/* At-risk alert */}
        {atRisk > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
            <p className="text-xs text-rose-700 font-semibold">
              <span className="font-black">
                {atRisk} student{atRisk !== 1 ? "s" : ""}
              </span>{" "}
              below 75% attendance — consider contacting their parents.
            </p>
            <button
              onClick={() => setFilter("at_risk")}
              className="ml-auto text-xs font-black text-rose-600 hover:underline shrink-0"
            >
              Show only →
            </button>
          </div>
        )}

        {/* Search + filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students…"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "at_risk", "male", "female"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs font-bold px-3 py-2 rounded-xl border transition-all capitalize ${
                  filter === f
                    ? f === "at_risk"
                      ? "bg-rose-500 text-white border-rose-500"
                      : "bg-sky-600 text-white border-sky-600"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                {f === "at_risk" ? "⚠ At Risk" : f}
              </button>
            ))}
          </div>
        </div>

        {/* Sort bar */}
        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 px-1">
          <span>Sort:</span>
          {(["name", "attendance", "assessments"] as SortKey[]).map((k) => (
            <button
              key={k}
              onClick={() => toggleSort(k)}
              className={`flex items-center gap-0.5 px-2 py-1 rounded-lg capitalize transition-colors ${
                sortKey === k ? "bg-sky-100 text-sky-700" : "hover:bg-slate-100"
              }`}
            >
              {k} <SortIcon k={k} />
            </button>
          ))}
          <span className="ml-auto">
            {sorted.length} of {students.length}
          </span>
        </div>

        {/* Student list */}
        {sorted.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-slate-500 font-semibold">No students match</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((s, idx) => {
              const isOpen = expanded === s.id;
              const age = calcAge(s.date_of_birth);
              const isAtRisk = s.total_days > 0 && s.attendance_rate < 75;

              return (
                <div
                  key={s.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                    isAtRisk ? "border-rose-200" : "border-slate-200"
                  }`}
                >
                  {/* Row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    {/* Position number */}
                    <span className="text-[10px] font-black text-slate-300 w-5 text-center shrink-0">
                      {idx + 1}
                    </span>

                    {/* Avatar */}
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                        s.gender === "Male"
                          ? "bg-sky-100 text-sky-700"
                          : s.gender === "Female"
                            ? "bg-pink-100 text-pink-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {getInitials(s.full_name)}
                    </div>

                    {/* Name + ID */}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-slate-800 truncate">
                        {s.full_name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {s.gender ?? "—"} · Age {age}
                        {s.readable_id && (
                          <span className="ml-1.5 font-mono text-amber-600">
                            #{s.readable_id}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Attendance */}
                    <div className="text-center shrink-0">
                      <AttRatePill rate={s.attendance_rate} />
                      {s.total_days > 0 && (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {s.present}P · {s.absent}A · {s.late}L
                        </p>
                      )}
                    </div>

                    {/* Assessment count */}
                    <div className="text-center shrink-0 w-16">
                      <p
                        className={`text-sm font-black ${s.assessment_count === 0 ? "text-amber-500" : "text-slate-700"}`}
                      >
                        {s.assessment_count}
                      </p>
                      <p className="text-[9px] text-slate-400">scores</p>
                    </div>

                    {/* At risk flag */}
                    {isAtRisk && (
                      <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}

                    <ChevronDown
                      className={`h-4 w-4 text-slate-300 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Attendance bar */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">
                            Attendance
                          </p>
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                            <div
                              className={`h-full rounded-full ${
                                s.attendance_rate >= 90
                                  ? "bg-emerald-400"
                                  : s.attendance_rate >= 75
                                    ? "bg-amber-400"
                                    : "bg-rose-400"
                              }`}
                              style={{ width: `${s.attendance_rate}%` }}
                            />
                          </div>
                          <div className="flex gap-3 text-[10px] font-semibold text-slate-600">
                            <span className="text-emerald-600">
                              ✓ {s.present} Present
                            </span>
                            <span className="text-rose-500">
                              ✗ {s.absent} Absent
                            </span>
                            <span className="text-amber-500">
                              ⏱ {s.late} Late
                            </span>
                          </div>
                        </div>

                        {/* Parent contact */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">
                            Parent / Guardian
                          </p>
                          {s.parent_name ? (
                            <div className="space-y-1.5">
                              <p className="text-xs font-bold text-slate-700">
                                {s.parent_name}
                              </p>
                              {s.parent_phone && (
                                <a
                                  href={`tel:${s.parent_phone}`}
                                  className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-semibold"
                                >
                                  <Phone className="h-3 w-3" />
                                  {s.parent_phone}
                                </a>
                              )}
                              {s.parent_email && (
                                <a
                                  href={`mailto:${s.parent_email}`}
                                  className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-semibold truncate"
                                >
                                  <Mail className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {s.parent_email}
                                  </span>
                                </a>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">
                              No parent linked
                            </p>
                          )}
                        </div>
                      </div>

                      {/* UPI */}
                      {s.upi_number && (
                        <p className="text-[10px] text-slate-400">
                          UPI:{" "}
                          <span className="font-mono font-bold text-slate-600">
                            {s.upi_number}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
