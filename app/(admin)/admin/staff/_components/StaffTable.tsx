"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Edit3, History, ChevronUp, ChevronDown } from "lucide-react";
import type { StaffMember } from "@/lib/types/auth";
import { Avatar, RoleBadge } from "./UI";

type SortField = "full_name" | "base_role" | "admin_role" | "created_at";
type SortDir = "asc" | "desc";

// ← Moved outside - This is the fix
function Th({
  field,
  children,
  sortField,
  sortDir,
  onSort,
}: {
  field: SortField;
  children: React.ReactNode;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-stone-500 hover:text-stone-700 transition-colors"
    >
      {children}
      {sortField === field ? (
        sortDir === "asc" ? (
          <ChevronUp className="h-3 w-3 text-amber-600" />
        ) : (
          <ChevronDown className="h-3 w-3 text-amber-600" />
        )
      ) : (
        <ChevronUp className="h-3 w-3 opacity-20" />
      )}
    </button>
  );
}

interface StaffTableProps {
  staff: StaffMember[];
  onEdit: (user: StaffMember) => void;
  onViewHistory: (user: StaffMember) => void;
  currentUserId: string;
}

export function StaffTable({
  staff,
  onEdit,
  onViewHistory,
  currentUserId,
}: StaffTableProps) {
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return [...staff]
      .filter((s) =>
        !q ||
        [
          s.full_name ?? "",
          s.email ?? "",
          s.base_role,
          s.admin_role_definition?.label ?? s.admin_role ?? "",
        ].some((v) => v.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        const vals: Record<SortField, [string, string]> = {
          full_name: [a.full_name ?? "", b.full_name ?? ""],
          base_role: [a.base_role, b.base_role],
          admin_role: [
            a.admin_role_definition?.label ?? a.admin_role ?? "",
            b.admin_role_definition?.label ?? b.admin_role ?? "",
          ],
          created_at: [a.created_at, b.created_at],
        };

        const [av, bv] = vals[sortField];
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [staff, query, sortField, sortDir]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or role…"
          className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-4 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-stone-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/80">
              <th className="py-3 pl-5 pr-4 text-left">
                <Th field="full_name" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                  Staff Member
                </Th>
              </th>
              <th className="py-3 px-4 text-left">
                <Th field="base_role" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                  Base Role
                </Th>
              </th>
              <th className="py-3 px-4 text-left hidden md:table-cell">
                <Th field="admin_role" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                  Admin Title
                </Th>
              </th>
              <th className="py-3 px-4 text-left hidden lg:table-cell">
                <Th field="created_at" sortField={sortField} sortDir={sortDir} onSort={handleSort}>
                  Joined
                </Th>
              </th>
              <th className="py-3 pl-4 pr-5 text-right">
                <span className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-sm text-stone-400">
                    {query ? `No results for "${query}"` : "No staff members found."}
                  </td>
                </tr>
              ) : (
                filtered.map((member, i) => (
                  <motion.tr
                    key={member.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.015, duration: 0.15 }}
                    className="group border-b border-stone-50 last:border-0 hover:bg-amber-50/30 transition-colors"
                  >
                    {/* ... rest of your row (unchanged) ... */}
                    <td className="py-3.5 pl-5 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar id={member.id} name={member.full_name} src={member.avatar_url} />
                        <div className="min-w-0">
                          <p className="font-medium text-stone-800 truncate">
                            {member.full_name ?? "—"}
                            {member.id === currentUserId && (
                              <span className="ml-2 text-xs font-normal text-amber-600">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-stone-400 truncate">
                            {member.email ?? member.id.slice(0, 12) + "…"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <RoleBadge role={member.base_role} type="base" />
                    </td>

                    <td className="py-3.5 px-4 hidden md:table-cell">
                      {member.admin_role ? (
                        <RoleBadge
                          role={member.admin_role}
                          type="admin"
                          label={member.admin_role_definition?.label}
                        />
                      ) : (
                        <span className="text-stone-300 text-xs">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 hidden lg:table-cell">
                      <span className="text-xs text-stone-400">
                        {new Date(member.created_at).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </td>

                    <td className="py-3.5 pl-4 pr-5">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <RowBtn
                          label="Edit role"
                          onClick={() => onEdit(member)}
                          icon={<Edit3 className="h-3.5 w-3.5" />}
                          cls="text-amber-700 hover:bg-amber-100"
                        />
                        <RowBtn
                          label="View history"
                          onClick={() => onViewHistory(member)}
                          icon={<History className="h-3.5 w-3.5" />}
                          cls="text-stone-500 hover:bg-stone-100"
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <p className="text-right text-xs text-stone-400">
        {filtered.length} of {staff.length} {staff.length === 1 ? "member" : "members"}
      </p>
    </div>
  );
}

// Keep RowBtn as is (it's fine inside or outside, but usually better outside too)
function RowBtn({ label, onClick, icon, cls }: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  cls: string;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${cls}`}
    >
      {icon}
      <span className="hidden xl:inline">{label.split(" ")[0]}</span>
    </button>
  );
}