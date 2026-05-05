"use client";

import type { SortDir, SortKey, Student } from "@/lib/types/dashboard";
import { useCallback, useMemo, useState } from "react";
import EditDrawer from "./_components/EditDrawer";
import Toast from "./_components/Toast";
import { printClassList } from "./utils";
import Toolbar from "./_components/Toolbar";
import Table from "./_components/Table";
import FilterSummary from "./_components/FilterSummary";

// ── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "transferred", label: "Transferred" },
  { id: "graduated", label: "Graduated" },
  { id: "withdrawn", label: "Withdrawn" },
] as const;

// ── Main Component ───────────────────────────────────────────────────────────

interface Props {
  students: Student[];
  uniqueGrades: string[];
  uniqueStreams: string[];
}

export function StudentsTableClient({
  students,
  uniqueGrades,
  uniqueStreams,
}: Props) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [streamFilter, setStreamFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("active");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setGradeFilter("");
    setStreamFilter("");
    setGenderFilter("");
  }, []);

  // ── Filtered & Sorted Data ─────────────────────────────────────────────────

  const filteredStudents = useMemo(() => {
    let result = [...students];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          (s.readable_id ?? "").toLowerCase().includes(q) ||
          (s.parents?.full_name ?? "").toLowerCase().includes(q)
      );
    }

    // Grade & Stream filters
    if (gradeFilter) result = result.filter((s) => s.current_grade === gradeFilter);
    if (streamFilter) result = result.filter((s) => s.current_stream === streamFilter);
    if (genderFilter) result = result.filter((s) => s.gender === genderFilter);

    // Sorting - Strictly Typed
    result.sort((a, b) => {
      const av = getSortableValue(a, sortKey);
      const bv = getSortableValue(b, sortKey);

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [students, search, gradeFilter, streamFilter, genderFilter, statusFilter, sortKey, sortDir]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: students.length };
    students.forEach((s) => {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
    });
    return counts;
  }, [students]);

  const hasActiveFilters = Boolean(search || gradeFilter || streamFilter || genderFilter);

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1 w-max flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === tab.id
                ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                : "text-white/35 hover:text-white"
            }`}
          >
            {tab.label}
            <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-white/40">
              {statusCounts[tab.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <Toolbar
        search={search}
        setSearch={setSearch}
        gradeFilter={gradeFilter}
        setGradeFilter={setGradeFilter}
        streamFilter={streamFilter}
        setStreamFilter={setStreamFilter}
        genderFilter={genderFilter}
        setGenderFilter={setGenderFilter}
        uniqueGrades={uniqueGrades}
        uniqueStreams={uniqueStreams}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        filteredStudents={filteredStudents}
        gradeFilterForExport={gradeFilter}
      />

      {/* Active Filter Summary */}
      {(gradeFilter || streamFilter) && (
        <FilterSummary
          gradeFilter={gradeFilter}
          streamFilter={streamFilter}
          filteredCount={filteredStudents.length}
          onPrint={() => printClassList(students, `${gradeFilter} ${streamFilter}`.trim())}
        />
      )}

      {/* Table */}
      <Table
        students={filteredStudents}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        onEdit={setEditStudent}
      />

      {/* Drawer & Toast */}
      {editStudent && (
        <EditDrawer
          student={editStudent}
          allGrades={uniqueGrades}
          allStreams={uniqueStreams}
          onClose={() => setEditStudent(null)}
          onToast={showToast}
        />
      )}

      {toast && <Toast type={toast.type} message={toast.message} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ── Helper for Strict Sorting ───────────────────────────────────────────────

function getSortableValue(student: Student, key: SortKey): string | number {
  switch (key) {
    case "full_name":
      return student.full_name;
    case "readable_id":
      return student.readable_id ?? "";
    case "current_grade":
      return student.current_grade;
    case "gender":
      return student.gender ?? "";
    case "date_of_birth":
      return student.date_of_birth ? new Date(student.date_of_birth).getTime() : 0;
    case "created_at":
      return student.created_at ? new Date(student.created_at).getTime() : 0;
    default:
      return "";
  }
}