import { ParentSearchResult, searchParentsAction } from "@/lib/actions/admit";
import { Search, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function ParentSearch({
  onSelect,
  disabled,
}: {
  onSelect: (p: ParentSearchResult) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (container.current && !container.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      if (v.trim().length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      const res = await searchParentsAction(v);
      setResults(res.data);
      setOpen(true);
      setLoading(false);
    }, 300);
  }

  return (
    <div ref={container} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          disabled={disabled}
          placeholder="Search parent by name, email or phone…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/50 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 animate-spin" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-[#111827] shadow-2xl overflow-hidden">
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
              {p.children.length > 0 && (
                <p className="text-[10px] text-amber-400/60 mt-0.5">
                  {p.children.length} enrolled:{" "}
                  {p.children.map((c) => c.full_name).join(", ")}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm text-white/30 shadow-2xl">
          No parents found matching "{query}"
        </div>
      )}
    </div>
  );
}
