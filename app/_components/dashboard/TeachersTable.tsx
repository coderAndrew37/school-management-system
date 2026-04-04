"use client";

import { useState, useMemo } from "react";
import { Teacher } from "@/lib/types/dashboard";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface TeachersTableProps {
  teachers: Teacher[];
}

type SortConfig = {
  key: keyof Teacher;
  direction: "asc" | "desc";
} | null;

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function TeachersTable({ teachers }: TeachersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "full_name",
    direction: "asc",
  });

  const ITEMS_PER_PAGE = 5;

  // 1. Filtering Logic
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      const search = searchQuery.toLowerCase();
      return (
        t.full_name.toLowerCase().includes(search) ||
        t.email.toLowerCase().includes(search) ||
        t.tsc_number?.toLowerCase().includes(search)
      );
    });
  }, [teachers, searchQuery]);

  // 2. Sorting Logic
  const sortedTeachers = useMemo(() => {
    if (!sortConfig) return filteredTeachers;

    return [...filteredTeachers].sort((a, b) => {
      const aValue = a[sortConfig.key] ?? "";
      const bValue = b[sortConfig.key] ?? "";

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTeachers, sortConfig]);

  // 3. Pagination Logic
  const totalPages = Math.ceil(sortedTeachers.length / ITEMS_PER_PAGE);
  const paginatedTeachers = sortedTeachers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const handleSort = (key: keyof Teacher) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  if (teachers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-5xl mb-4">📋</p>
        <p className="text-white/50 font-medium">No teachers on record</p>
        <p className="text-white/25 text-sm mt-1">
          Teacher records will appear here once added.
        </p>
      </div>
    );
  }

  const SortIcon = ({ column }: { column: keyof Teacher }) => {
    if (sortConfig?.key !== column)
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3 text-emerald-400" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 text-emerald-400" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative group max-w-md">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-white/20 group-focus-within:text-emerald-400 transition-colors" />
        </div>
        <input
          type="text"
          placeholder="Search by name, email, or TSC..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40 transition-all"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.01]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                <th
                  className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("full_name")}
                >
                  <div className="flex items-center">
                    Teacher <SortIcon column="full_name" />
                  </div>
                </th>
                <th
                  className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("tsc_number")}
                >
                  <div className="flex items-center">
                    TSC Number <SortIcon column="tsc_number" />
                  </div>
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 hidden md:table-cell">
                  Email
                </th>
                <th className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 hidden lg:table-cell">
                  Phone
                </th>
                <th
                  className="text-left px-5 py-3.5 text-[10px] font-semibold uppercase tracking-widest text-white/35 hidden xl:table-cell cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort("created_at")}
                >
                  <div className="flex items-center">
                    Joined <SortIcon column="created_at" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {paginatedTeachers.map((teacher) => (
                <tr
                  key={teacher.id}
                  className="group hover:bg-white/[0.04] transition-colors duration-150"
                >
                  {/* Name + Avatar */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0 h-9 w-9 rounded-lg bg-emerald-400/10 border border-emerald-400/20 overflow-hidden flex items-center justify-center text-[10px] font-bold text-emerald-400">
                        {teacher.avatar_url ? (
                          <Image
                            src={teacher.avatar_url}
                            alt={teacher.full_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          getInitials(teacher.full_name)
                        )}
                      </div>
                      <span className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                        {teacher.full_name}
                      </span>
                    </div>
                  </td>

                  {/* TSC Number */}
                  <td className="px-5 py-4">
                    {teacher.tsc_number ? (
                      <span className="font-mono text-[11px] bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded-md px-2 py-1">
                        {teacher.tsc_number}
                      </span>
                    ) : (
                      <span className="text-white/25 text-xs italic">
                        Not set
                      </span>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-5 py-4 hidden md:table-cell">
                    <a
                      href={`mailto:${teacher.email}`}
                      className="text-white/60 hover:text-sky-400 transition-colors duration-150 text-xs"
                    >
                      {teacher.email}
                    </a>
                  </td>

                  {/* Phone */}
                  <td className="px-5 py-4 hidden lg:table-cell">
                    {teacher.phone_number ? (
                      <span className="font-mono text-xs text-white/60">
                        {teacher.phone_number}
                      </span>
                    ) : (
                      <span className="text-white/25 text-xs italic">—</span>
                    )}
                  </td>

                  {/* Joined date */}
                  <td className="px-5 py-4 hidden xl:table-cell">
                    <span className="text-xs text-white/35">
                      {formatDate(teacher.created_at)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination & Footer Link */}
        <div className="px-5 py-4 bg-white/[0.02] border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/teachers"
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Manage All Teachers
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-white/30">
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>
            <div className="flex items-center gap-1">
              <button
                aria-label="Previous page"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-white/[0.07] hover:bg-white/[0.05] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4 text-white" />
              </button>
              <button
                aria-label="Next page"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg border border-white/[0.07] hover:bg-white/[0.05] disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
