"use client";

import { useState, useMemo, useCallback, ReactNode } from "react";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  Filter,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * T is the record type (e.g., Student or Teacher).
 * We use 'string' for the key to allow virtual columns like "Actions".
 */
export interface ColumnDef<T> {
  key: string;
  label: string;
  sortable?: boolean;
  /** Custom extractor for sorting (e.g., (s) => new Date(s.created_at).getTime()) */
  sortValue?: (row: T) => string | number;
  render: (row: T) => ReactNode;
  className?: string;
}

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDef<T> {
  key: keyof T;
  placeholder: string;
  options: FilterOption[];
}

export interface DataTableProps<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  rowKey: keyof T;
  /** Fields to search. Can be a key of T or a function for deep searching */
  searchFields: (keyof T | ((row: T) => string))[];
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  emptyIcon?: string;
  emptyMessage?: string;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DataTable<T extends object>({
  rows,
  columns,
  rowKey,
  searchFields,
  searchPlaceholder = "Search…",
  filters = [],
  defaultSortKey,
  defaultSortDir = "asc",
  emptyIcon = "📋",
  emptyMessage = "No records found",
}: DataTableProps<T>) {
  // ── State ──
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<
    Partial<Record<keyof T, string>>
  >(
    () =>
      Object.fromEntries(filters.map((f) => [f.key, ""])) as Partial<
        Record<keyof T, string>
      >,
  );
  const [sortKey, setSortKey] = useState<string>(
    defaultSortKey ?? columns.find((c) => c.sortable)?.key ?? "",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);

  // ── Handlers ──
  const handleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const clearAll = () => {
    setSearch("");
    const resetFilters = Object.fromEntries(
      filters.map((f) => [f.key, ""]),
    ) as Partial<Record<keyof T, string>>;
    setFilterValues(resetFilters);
  };

  const hasActiveFilters = search || filters.some((f) => filterValues[f.key]);

  // ── Logic: Filter, Search, Sort ──
  const processed = useMemo(() => {
    let result = [...rows];

    // 1. Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        searchFields.some((field) => {
          const val =
            typeof field === "function" ? field(row) : String(row[field] ?? "");
          return val.toLowerCase().includes(q);
        }),
      );
    }

    // 2. Filters
    filters.forEach((f) => {
      const val = filterValues[f.key];
      if (val) {
        result = result.filter((row) => String(row[f.key] ?? "") === val);
      }
    });

    // 3. Sort
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      result.sort((a, b) => {
        // We use a type assertion here safely because we know sortKey exists via props
        const av = col?.sortValue
          ? col.sortValue(a)
          : ((a[sortKey as keyof T] as unknown as string | number) ?? "");
        const bv = col?.sortValue
          ? col.sortValue(b)
          : ((b[sortKey as keyof T] as unknown as string | number) ?? "");

        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [
    rows,
    search,
    filterValues,
    sortKey,
    sortDir,
    columns,
    filters,
    searchFields,
  ]);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40 focus:bg-white/[0.06] transition-all duration-200"
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

        {/* Dynamic Filters */}
        {filters.map((f, i) => (
          <div key={String(f.key)} className="relative">
            {i === 0 && (
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
            )}
            <select
              aria-label="filters"
              value={filterValues[f.key] ?? ""}
              onChange={(e) =>
                setFilterValues((prev) => ({
                  ...prev,
                  [f.key]: e.target.value,
                }))
              }
              className={`appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl ${i === 0 ? "pl-8" : "pl-4"} pr-8 py-2.5 text-sm text-white/70 outline-none cursor-pointer focus:border-amber-400/40 transition-all`}
            >
              <option value="">{f.placeholder}</option>
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
          </div>
        ))}

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/40 hover:text-white/70 transition-all"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      {processed.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          message={emptyMessage}
          hasFilters={!!hasActiveFilters}
          onClear={clearAll}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
          <table className="w-full text-sm border-collapse text-left">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={
                      col.sortable ? () => handleSort(col.key) : undefined
                    }
                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-widest text-white/30 whitespace-nowrap ${col.sortable ? "cursor-pointer hover:text-white/60 select-none transition-colors" : ""} ${col.className ?? ""}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {col.label}
                      {col.sortable && (
                        <SortIcon active={sortKey === col.key} dir={sortDir} />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {processed.map((row, idx) => (
                <tr
                  key={String(row[rowKey])}
                  className={`border-b border-white/[0.04] last:border-0 hover:bg-amber-400/[0.03] transition-colors ${idx % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 whitespace-nowrap ${col.className ?? ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Internal Helpers ──

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown className="h-3 w-3 text-white/20" />;
  return dir === "asc" ? (
    <ChevronUp className="h-3 w-3 text-amber-400" />
  ) : (
    <ChevronDown className="h-3 w-3 text-amber-400" />
  );
}

function EmptyState({
  icon,
  message,
  hasFilters,
  onClear,
}: {
  icon: string;
  message: string;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-white/[0.07] bg-white/[0.02]">
      <p className="text-5xl mb-4">{hasFilters ? "🔍" : icon}</p>
      <p className="text-white/50 font-medium">
        {hasFilters ? "No records match your filters" : message}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-3 text-xs text-amber-400/60 hover:text-amber-400 underline underline-offset-2"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
