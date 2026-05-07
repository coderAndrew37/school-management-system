"use client";

import type { ParentSearchResult } from "@/lib/actions/admit";
import { Loader2, Search, Trash2, User, UserCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useParentSearch } from "./useParentSearch";

interface ParentSearchProps {
  selected: ParentSearchResult | null;
  onSelect: (p: ParentSearchResult | null) => void;
}

export function ParentSearch({ selected, onSelect }: ParentSearchProps) {
  const [query, setQuery] = useState("");
  const { results, loading, isOpen, close, open } = useParentSearch(query);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!ref.current?.contains(e.relatedTarget as Node)) {
      close();
    }
  };

  // Show selected parent
  if (selected) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
          <UserCheck className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{selected.full_name}</p>
          <p className="text-xs text-white/40 truncate">
            {selected.email} · {selected.phone_number}
          </p>
          {selected.children.length > 0 && (
            <p className="text-[11px] text-emerald-400/60 mt-0.5">
              {selected.children.length} child{selected.children.length > 1 ? "ren" : ""}:{" "}
              {selected.children.map((c) => c.full_name).join(", ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
          className="p-1.5 rounded-lg text-white/25 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
          aria-label="Remove selected parent"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative" onBlur={handleBlur}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />

        <input
          type="text"
          role="combobox"
          aria-label="Search for existing parent"
          aria-autocomplete="list"
          aria-expanded={isOpen}                    // ← Fixed: use isOpen (boolean)
          aria-haspopup="listbox"
          aria-controls="parent-search-listbox"
          placeholder="Search by name, email or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => open()}                    // ← Call the open function
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.06] transition-all"
        />

        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 animate-spin" />
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <ul
          id="parent-search-listbox"
          role="listbox"
          className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-xl border border-white/10 bg-[#101525] shadow-2xl shadow-black/70 overflow-hidden"
        >
          {results.map((p) => (
            <li key={p.id} role="option">
              <button
                type="button"
                onMouseDown={() => {
                  onSelect(p);
                  close();
                  setQuery("");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.04] last:border-0"
              >
                <div className="h-8 w-8 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-amber-400/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{p.full_name}</p>
                  <p className="text-xs text-white/40 truncate">
                    {p.email} · {p.phone_number}
                  </p>
                  {p.children.length > 0 && (
                    <p className="text-[11px] text-white/25 mt-0.5">
                      Children: {p.children.map((c) => `${c.full_name} (${c.current_grade})`).join(", ")}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* No Results */}
      {isOpen && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-xl border border-white/10 bg-[#101525] px-4 py-3">
          <p className="text-sm text-white/40">No parents found for &quot;{query}&quot;</p>
          <p className="text-xs text-white/25 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}