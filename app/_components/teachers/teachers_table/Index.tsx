"use client";

import { Plus, Search } from "lucide-react";
import { useState } from "react";

// Local Components
import { TeacherEditDrawer } from "./TeacherEditDrawer";
import { TeachersFilter } from "./TeachersFilter";
import { TeachersTableContent } from "./TeachersTableContent";
import { useTeachersFilter } from "./useTeachersFilters"; // Changed from useTeachersFilters to match the export

import type { Teacher } from "@/lib/types/dashboard";
import RegisterTeacherModal from "../RegisterTeacherModal";

interface TeachersIndexProps {
  initialTeachers: Teacher[];
  academicYear: number;
}

export default function TeachersIndex({
  initialTeachers,
  academicYear,
}: TeachersIndexProps) {
  const {
    filteredTeachers,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortConfig,
  } = useTeachersFilter(initialTeachers);

  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const stats = {
    total: initialTeachers.length,
    active: initialTeachers.filter((t) => t.status === "active").length,
    onLeave: initialTeachers.filter((t) => t.status === "on_leave").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Staff Directory
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Manage faculty members, track allocations, and handle account
            access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-white/30 font-bold">
                Total Staff
              </span>
              <span className="text-sm font-mono text-amber-400">
                {stats.total}
              </span>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-white/30 font-bold">
                Active
              </span>
              <span className="text-sm font-mono text-emerald-400">
                {stats.active}
              </span>
            </div>
          </div>

          <RegisterTeacherModal/>
        </div>
      </div>

      <TeachersFilter
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {filteredTeachers.length > 0 ? (
        <TeachersTableContent
          teachers={filteredTeachers}
          onEdit={setSelectedTeacher}
          sortConfig={sortConfig}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
          <div className="h-12 w-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
            <Search className="h-6 w-6 text-white/20" />
          </div>
          <p className="text-white/40 font-medium">
            No teachers found matching your criteria
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="mt-2 text-xs text-amber-400/60 hover:text-amber-400 underline underline-offset-4"
          >
            Clear all filters
          </button>
        </div>
      )}

      {selectedTeacher && (
        <TeacherEditDrawer
          teacher={selectedTeacher}
          academicYear={academicYear}
          onClose={() => setSelectedTeacher(null)}
        />
      )}
    </div>
  );
}
