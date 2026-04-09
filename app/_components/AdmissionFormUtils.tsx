import { ParentSearchResult, searchParentsAction } from "@/lib/actions/admit";
import { CheckCircle2, X, Search, Loader2, School } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase/client"; // Assuming you have a standard client

// ── Components ─────────────────────────────────────────────────────────────

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-rose-400 flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-rose-400" />
      {message}
    </p>
  );
}

export function Label({
  htmlFor,
  icon,
  children,
}: {
  htmlFor: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-400/80 mb-2"
    >
      <span className="text-amber-400">{icon}</span>
      {children}
    </label>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-1">
      <div className="h-px flex-1 bg-white/[0.06]" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/20">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}

// ── New: Class Selector (Implementation for the New Schema) ────────────────

export function ClassSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [classes, setClasses] = useState<{ id: string; grade: string; stream: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClasses() {
      const { data } = await supabase
        .from("classes")
        .select("id, grade, stream")
        .eq("academic_year", 2026) // Strictly for the current year
        .order("grade", { ascending: true });
      
      if (data) setClasses(data);
      setLoading(false);
    }
    fetchClasses();
  }, []);

  return (
    <div className="relative">
      <select
      aria-label="Select Class"
        id="classId"
        name="classId"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
      >
        <option value="" className="bg-[#111827]">Select a specific class...</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id} className="bg-[#111827]">
            {c.grade} — {c.stream}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/20">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <School className="h-4 w-4" />}
      </div>
    </div>
  );
}

// ── Parent search combobox ────────────────────────────────────────────────────

export function ParentSearchBox({
  onSelect,
  selected,
  disabled,
}: {
  onSelect: (p: ParentSearchResult | null) => void;
  selected: ParentSearchResult | null;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const container = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    const res = await searchParentsAction(q);
    setResults(res.data);
    setOpen(true);
    setSearching(false);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(v), 300);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-white truncate">
                {selected.full_name}
              </p>
            </div>
            <p className="text-xs text-white/40">{selected.email}</p>
            {selected.phone_number && (
              <p className="text-xs text-white/30">{selected.phone_number}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Deselect parent"
            onClick={() => onSelect(null)}
            disabled={disabled}
            className="text-white/30 hover:text-white flex-shrink-0 mt-0.5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {selected.children.length > 0 && (
          <div className="mt-3 pt-3 border-t border-emerald-400/15">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/50 mb-1.5">
              Already enrolled ({selected.children.length})
            </p>
            <div className="space-y-1">
              {selected.children.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 text-xs text-white/50"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/40 flex-shrink-0" />
                  <span>{c.full_name}</span>
                  <span className="text-white/25">·</span>
                  <span className="text-white/35">{c.current_grade}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={container} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
        <input
          id="parentSearch"
          type="text"
          value={query}
          onChange={handleChange}
          disabled={disabled}
          autoComplete="off"
          placeholder="Search by name, email, or phone…"
          className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-10 py-3 text-sm text-white placeholder-white/25 outline-none transition-all focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 animate-spin" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-white/10 bg-[#111827] shadow-2xl overflow-hidden">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
            >
              <p className="text-sm font-medium text-white">{p.full_name}</p>
              <p className="text-xs text-white/40">{p.email}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}