"use client";

import { fmt } from "@/app/_components/parents/parent-utils";
import { calcAge } from "@/lib/helpers/parent";
import type { Student } from "@/lib/types/dashboard";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Download,
  Filter,
  GraduationCap,
  Layers,
  Pencil,
  Printer,
  Search,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import Toast from "./_components/Toast";
import { exportToCSV, printClassList, SortDir, SortKey } from "./utils";
import EditDrawer from "./_components/EditDrawer";
import StudentAvatar from "./_components/StudentAvatar";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-400",
  transferred: "text-amber-400",
  graduated: "text-sky-400",
  withdrawn: "text-rose-400",
};

const TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "transferred", label: "Transferred" },
  { id: "graduated", label: "Graduated" },
  { id: "withdrawn", label: "Withdrawn" },
];

const COLS: { key: SortKey | null; label: string }[] = [
  { key: "full_name", label: "Student" },
  { key: "readable_id", label: "ID" },
  { key: "current_grade", label: "Grade/Stream" }, // Updated label
  { key: "gender", label: "Gender" },
  { key: "date_of_birth", label: "Age / DOB" },
  { key: null, label: "Parent" },
  { key: "created_at", label: "Admitted" },
  { key: null, label: "" },
];

// ── Main Component ───────────────────────────────────────────────────────────

interface Props {
  students: Student[];
  uniqueGrades: string[];
  uniqueStreams: string[]; // Added this prop
}

export function StudentsTableClient({
  students,
  uniqueGrades,
  uniqueStreams,
}: Props) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [streamFilter, setStreamFilter] = useState(""); // New state
  const [genderFilter, setGenderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prevKey;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const showToast = useCallback(
    (type: "success" | "error", message: string) => {
      setToast({ type, message });
      setTimeout(() => setToast(null), 4000);
    },
    [],
  );

  const hasActiveFilters = Boolean(
    search || gradeFilter || streamFilter || genderFilter,
  );

  const filtered = useMemo(() => {
    let result = [...students];

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          (s.readable_id ?? "").toLowerCase().includes(q) ||
          (s.parents?.full_name ?? "").toLowerCase().includes(q),
      );
    }

    if (gradeFilter)
      result = result.filter((s) => s.current_grade === gradeFilter);
    if (streamFilter)
      result = result.filter((s) => s.current_stream === streamFilter);
    if (genderFilter) result = result.filter((s) => s.gender === genderFilter);

    result.sort((a, b) => {
      let av = (a as any)[sortKey] ?? "";
      let bv = (b as any)[sortKey] ?? "";

      if (sortKey === "date_of_birth" || sortKey === "created_at") {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    students,
    search,
    gradeFilter,
    streamFilter,
    genderFilter,
    statusFilter,
    sortKey,
    sortDir,
  ]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: students.length };
    students.forEach((s) => {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
    });
    return counts;
  }, [students]);

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1 w-max flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setStatusFilter(t.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === t.id
                ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                : "text-white/35 hover:text-white"
            }`}
          >
            {t.label}
            <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-white/40">
              {statusCounts[t.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, ID or parent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40 transition-all"
          />
        </div>

        {/* Grade Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 cursor-pointer transition-all"
          >
            <option value="">All Grades</option>
            {uniqueGrades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        </div>

        {/* Stream Filter */}
        <div className="relative">
          <Layers className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
          <select
            value={streamFilter}
            onChange={(e) => setStreamFilter(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 cursor-pointer transition-all"
          >
            <option value="">All Streams</option>
            {uniqueStreams.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 cursor-pointer transition-all"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearch("");
              setGradeFilter("");
              setStreamFilter("");
              setGenderFilter("");
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/40 hover:text-white/70 transition-all"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}

        <button
          onClick={() => exportToCSV(filtered, gradeFilter || undefined)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white/50 hover:text-white transition-all"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* Class/Stream summary strip */}
      {(gradeFilter || streamFilter) && (
        <div className="flex items-center gap-3 flex-wrap rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
          <div className="flex items-center gap-2 text-amber-400">
            <GraduationCap className="h-4 w-4" />
            <span className="text-sm font-bold">
              {gradeFilter || "All"} {streamFilter ? `— ${streamFilter}` : ""}
            </span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-xs text-white/50">
            {filtered.length} students
          </span>
          <span className="text-[10px] text-sky-400 font-semibold bg-sky-400/10 border border-sky-400/15 rounded-md px-2 py-0.5">
            {filtered.filter((s) => s.gender === "Male").length} boys
          </span>
          <span className="text-[10px] text-rose-400 font-semibold bg-rose-400/10 border border-rose-400/15 rounded-md px-2 py-0.5">
            {filtered.filter((s) => s.gender === "Female").length} girls
          </span>
          <div className="ml-auto">
            <button
              onClick={() =>
                printClassList(
                  students,
                  `${gradeFilter} ${streamFilter}`.trim(),
                )
              }
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white transition-all"
            >
              <Printer className="h-3.5 w-3.5" /> Print Register
            </button>
          </div>
        </div>
      )}

      {/* Table Section */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-white/[0.07] bg-white/[0.03]">
              {COLS.map(({ key, label }) => (
                <th
                  key={label}
                  onClick={key ? () => handleSort(key) : undefined}
                  className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/30 ${key ? "cursor-pointer hover:text-white/60 select-none" : ""}`}
                >
                  <span className="flex items-center gap-1.5">
                    {label}
                    {key &&
                      sortKey === key &&
                      (sortDir === "asc" ? (
                        <ChevronUp className="h-3 w-3 text-amber-400" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-amber-400" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((student, idx) => (
              <tr
                key={student.id}
                className={`border-b border-white/[0.04] transition-colors hover:bg-amber-400/[0.03] ${idx % 2 === 0 ? "bg-white/[0.01]" : ""} ${student.status !== "active" ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <StudentAvatar student={student} />
                    <div>
                      <p className="font-medium text-white">
                        {student.full_name}
                      </p>
                      {student.status !== "active" && (
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLES[student.status] || "text-white/40"}`}
                        >
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
                    className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${student.gender === "Male" ? "bg-sky-400/10 text-sky-400 border-sky-400/20" : "bg-rose-400/10 text-rose-400 border-rose-400/20"}`}
                  >
                    {student.gender || "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-white/80">
                    {calcAge(student.date_of_birth)} yrs
                  </span>
                </td>
                <td className="px-4 py-3 text-white/60 text-xs">
                  {student.parents?.full_name || "—"}
                </td>
                <td className="px-4 py-3 text-white/30 text-xs">
                  {fmt(student.created_at)}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setEditStudent(student)}
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

      {editStudent && (
        <EditDrawer
          student={editStudent}
          allGrades={uniqueGrades}
          allStreams={uniqueStreams} // Pass unique streams to the drawer
          onClose={() => setEditStudent(null)}
          onToast={showToast}
        />
      )}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
