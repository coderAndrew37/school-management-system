"use client";

import { useState, useCallback, useMemo } from "react";
import type { Teacher, TeacherStatus } from "@/lib/types/dashboard";

export type SortKey =
  | "full_name"
  | "tsc_number"
  | "email"
  | "status"
  | "created_at";
export type SortDir = "asc" | "desc";

export function useTeachersFilter(teachers: Teacher[]) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherStatus | "all">(
    "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const onSort = useCallback(
    (key: SortKey) => {
      setSortDir((prev) =>
        sortKey === key ? (prev === "asc" ? "desc" : "asc") : "asc",
      );
      setSortKey(key);
    },
    [sortKey],
  );

  const filteredTeachers = useMemo(() => {
    return teachers
      .filter((t) => {
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.full_name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          (t.tsc_number ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let av = (a as any)[sortKey] ?? "";
        let bv = (b as any)[sortKey] ?? "";

        if (sortKey === "created_at") {
          av = new Date(av).getTime();
          bv = new Date(bv).getTime();
        }

        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [teachers, searchQuery, statusFilter, sortKey, sortDir]);

  return {
    filteredTeachers,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortConfig: {
      key: sortKey,
      dir: sortDir,
      onSort,
    },
  };
}
