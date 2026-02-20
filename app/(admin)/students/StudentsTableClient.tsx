"use client";

import { Student } from "@/lib/types/dashboard";
import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Filter,
  Search,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function formatDOB(dob: string): string {
  return new Date(dob).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const avatarColors = [
  "from-amber-400 to-orange-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-blue-400",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length]!;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type SortKey =
  | "full_name"
  | "readable_id"
  | "current_grade"
  | "date_of_birth"
  | "gender"
  | "created_at";
type SortDir = "asc" | "desc";

// ── Client Component ───────────────────────────────────────────────────────────

interface StudentsTableClientProps {
  students: Student[];
  uniqueGrades: string[];
}

export function StudentsTableClient({
  students,
  uniqueGrades,
}: StudentsTableClientProps) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const clearFilters = () => {
    setSearch("");
    setGradeFilter("");
    setGenderFilter("");
  };

  const hasActiveFilters = search || gradeFilter || genderFilter;

  const filtered = useMemo(() => {
    let result = [...students];

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
    if (genderFilter) result = result.filter((s) => s.gender === genderFilter);

    result.sort((a, b) => {
      let av: string | number = a[sortKey] ?? "";
      let bv: string | number = b[sortKey] ?? "";

      if (sortKey === "date_of_birth" || sortKey === "created_at") {
        av = new Date(av as string).getTime();
        bv = new Date(bv as string).getTime();
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [students, search, gradeFilter, genderFilter, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, ID or parent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40 focus:bg-white/[0.06] transition-all duration-200"
          />
          {search && (
            <button
              aria-label="clear search"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Grade filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
          <select
            aria-label="grade filter"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 focus:bg-white/[0.06] transition-all duration-200 cursor-pointer"
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

        {/* Gender filter */}
        <div className="relative">
          <select
            aria-label="gender filter"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 focus:bg-white/[0.06] transition-all duration-200 cursor-pointer"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/40 hover:text-white/70 hover:border-white/[0.16] transition-all duration-200"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* ── Result count ── */}
      <p className="text-xs text-white/25 font-mono">
        {filtered.length} {filtered.length === 1 ? "student" : "students"} found
        {hasActiveFilters && " · filters active"}
      </p>

      {/* ── Table ── */}
      {filtered.length === 0 ? (
        <EmptyState onClear={clearFilters} hasFilters={!!hasActiveFilters} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                {(
                  [
                    { key: "full_name", label: "Student" },
                    { key: "readable_id", label: "ID" },
                    { key: "current_grade", label: "Grade" },
                    { key: "gender", label: "Gender" },
                    { key: "date_of_birth", label: "Age / DOB" },
                    { key: null, label: "Parent" },
                    { key: "created_at", label: "Admitted" },
                  ] as { key: SortKey | null; label: string }[]
                ).map(({ key, label }) => (
                  <th
                    key={label}
                    className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/30 whitespace-nowrap ${key ? "cursor-pointer hover:text-white/60 select-none transition-colors duration-150" : ""}`}
                    onClick={key ? () => handleSort(key) : undefined}
                  >
                    <span className="flex items-center gap-1.5">
                      {label}
                      {key && (
                        <SortIcon active={sortKey === key} dir={sortDir} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, idx) => (
                <StudentRow
                  key={student.id}
                  student={student}
                  isEven={idx % 2 === 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

function StudentRow({
  student,
  isEven,
}: {
  student: Student;
  isEven: boolean;
}) {
  const initials = getInitials(student.full_name);
  const avatarColor = getAvatarColor(student.full_name);

  return (
    <tr
      className={`border-b border-white/[0.04] last:border-0 transition-colors duration-150 hover:bg-amber-400/[0.03] ${isEven ? "bg-white/[0.01]" : ""}`}
    >
      {/* Name + avatar */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div
            className={`flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center text-xs font-bold text-white`}
          >
            {initials}
          </div>
          <span className="font-medium text-white">{student.full_name}</span>
        </div>
      </td>

      {/* ID */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="font-mono text-xs text-amber-400/80">
          {student.readable_id ?? "—"}
        </span>
      </td>

      {/* Grade */}
      <td className="px-4 py-3 whitespace-nowrap text-white/70">
        {student.current_grade}
      </td>

      {/* Gender */}
      <td className="px-4 py-3 whitespace-nowrap">
        {student.gender ? (
          <span
            className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              student.gender === "Male"
                ? "bg-sky-400/10 text-sky-400 border-sky-400/20"
                : "bg-rose-400/10 text-rose-400 border-rose-400/20"
            }`}
          >
            {student.gender}
          </span>
        ) : (
          <span className="text-white/25">—</span>
        )}
      </td>

      {/* Age / DOB */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-white/80">
          {calcAge(student.date_of_birth)} yrs
        </span>
        <span className="text-white/30 text-xs ml-1.5">
          {formatDOB(student.date_of_birth)}
        </span>
      </td>

      {/* Parent */}
      <td className="px-4 py-3 whitespace-nowrap">
        {student.parents ? (
          <div>
            <p className="text-white/60 text-xs truncate max-w-[160px]">
              {student.parents.full_name !== "To be updated"
                ? student.parents.full_name
                : "—"}
            </p>
            <p className="text-white/30 text-xs font-mono">
              {student.parents.phone_number}
            </p>
          </div>
        ) : (
          <span className="text-white/25">—</span>
        )}
      </td>

      {/* Admitted */}
      <td className="px-4 py-3 whitespace-nowrap text-white/30 text-xs">
        {formatDate(student.created_at)}
      </td>
    </tr>
  );
}

// ── Sort icon ──────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-white/20" />;
  if (dir === "asc") return <ChevronUp className="h-3 w-3 text-amber-400" />;
  return <ChevronDown className="h-3 w-3 text-amber-400" />;
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({
  onClear,
  hasFilters,
}: {
  onClear: () => void;
  hasFilters: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <p className="text-5xl mb-4">{hasFilters ? "🔍" : "🎒"}</p>
      <p className="text-white/50 font-medium">
        {hasFilters
          ? "No students match your filters"
          : "No students admitted yet"}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-3 text-xs text-amber-400/60 hover:text-amber-400 underline underline-offset-2 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
