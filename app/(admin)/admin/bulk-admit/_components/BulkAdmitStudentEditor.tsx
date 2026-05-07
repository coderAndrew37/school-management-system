"use client";

import type { BulkAdmitRow } from "@/lib/actions/bulk-admit";
import type { ParentSearchResult } from "@/lib/actions/admit";
import { searchParentsAction } from "@/lib/actions/admit";
import {
  Plus, Save, Trash2, GraduationCap, Copy, ChevronDown,
  ChevronUp, User, Mail, Phone, Search, UserCheck,
  UserPlus, AlertCircle, CheckCircle2, Users, Loader2,
} from "lucide-react";
import { useMemo, useRef, useCallback, useState, useEffect } from "react";

// ── Inline debounce ────────────────────────────────────────────────────────
function useDebounceValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

const RELATIONSHIP_OPTIONS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "guardian", label: "Guardian" },
  { value: "other", label: "Other" },
] as const;

const CURRENT_YEAR = 2026;

// ── Row meta (UI state separate from data) ─────────────────────────────────
interface RowMeta {
  parentExpanded: boolean;
  selectedParent: ParentSearchResult | null;
}

interface Props {
  classes: { id: string; grade: string; stream: string }[];
  rows: BulkAdmitRow[];
  setRows: React.Dispatch<React.SetStateAction<BulkAdmitRow[]>>;
  isPending: boolean;
  onSubmit: () => void;
}

// ── Blank row factory ──────────────────────────────────────────────────────
function blankRow(grade: string, stream: string): BulkAdmitRow {
  return {
    studentName: "",
    dateOfBirth: "",
    gender: "Male",
    currentGrade: grade,
    stream,
    academicYear: CURRENT_YEAR,
    relationshipType: "guardian",
    parentMode: "new",
    existingParentId: null,
    parentName: "",
    parentEmail: "",
    parentPhone: "",
  };
}

// ── Completion check ───────────────────────────────────────────────────────
function isComplete(row: BulkAdmitRow, meta: RowMeta): boolean {
  if (!row.studentName.trim() || !row.dateOfBirth) return false;
  if (row.parentMode === "existing") return !!meta.selectedParent;
  return !!(row.parentName?.trim() && row.parentEmail?.trim() && row.parentPhone?.trim());
}

// ── Parent Search Combobox ─────────────────────────────────────────────────
function ParentSearch({
  selected,
  onSelect,
}: {
  selected: ParentSearchResult | null;
  onSelect: (p: ParentSearchResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const dQuery = useDebounceValue(query, 350);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (dQuery.length < 2) { setResults([]); return; }
    setLoading(true);
    searchParentsAction(dQuery).then((res) => {
      setResults(res.data);
      setLoading(false);
      setOpen(true);
    });
  }, [dQuery]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
          <UserCheck className="h-4 w-4 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{selected.full_name}</p>
          <p className="text-xs text-white/40 truncate">{selected.email} · {selected.phone_number}</p>
          {selected.children.length > 0 && (
            <p className="text-[11px] text-emerald-400/60 mt-0.5">
              {selected.children.length} existing child{selected.children.length > 1 ? "ren" : ""}: {selected.children.map(c => c.full_name).join(", ")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { onSelect(null); setQuery(""); }}
          className="p-1.5 rounded-lg text-white/25 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
          aria-label="Remove parent"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, email or phone…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (!e.target.value) setOpen(false); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-400/40 focus:bg-white/[0.06] transition-all"
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 animate-spin" />}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-xl border border-white/10 bg-[#101525] shadow-2xl shadow-black/70 overflow-hidden">
          {results.map((p) => (
            <button
            aria-label="close"
              key={p.id}
              type="button"
              onClick={() => { onSelect(p); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors text-left border-b border-white/[0.04] last:border-0"
            >
              <div className="h-8 w-8 rounded-lg bg-amber-400/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-amber-400/70" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{p.full_name}</p>
                <p className="text-xs text-white/40 truncate">{p.email} · {p.phone_number}</p>
                {p.children.length > 0 && (
                  <p className="text-[11px] text-white/25 mt-0.5">
                    Children: {p.children.map(c => `${c.full_name} (${c.current_grade})`).join(", ")}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-xl border border-white/10 bg-[#101525] px-4 py-3">
          <p className="text-sm text-white/40">No parents found for "{query}"</p>
          <p className="text-xs text-white/25 mt-1">Try a different name, email, or phone number</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function BulkAdmitStudentEditor({ classes, rows, setRows, isPending, onSubmit }: Props) {
  const [metas, setMetas] = useState<RowMeta[]>([{ parentExpanded: false, selectedParent: null }]);

  const availableGrades = useMemo(
    () => Array.from(new Set(classes.map((c) => c.grade))).sort(),
    [classes]
  );
  const streamsFor = useCallback(
    (grade: string) => classes.filter((c) => c.grade === grade).map((c) => c.stream),
    [classes]
  );
  const firstGrade = availableGrades[0] ?? "";
  const firstStream = streamsFor(firstGrade)[0] ?? "Main";

  // Keep metas in sync with rows length
  useEffect(() => {
    setMetas((prev) => {
      if (prev.length === rows.length) return prev;
      if (rows.length > prev.length) {
        return [...prev, ...Array(rows.length - prev.length).fill(null).map(() => ({ parentExpanded: false, selectedParent: null }))];
      }
      return prev.slice(0, rows.length);
    });
  }, [rows.length]);

  // ── Mutations ──────────────────────────────────────────────────────────
  const addRow = () => {
    setRows((p) => [...p, blankRow(firstGrade, firstStream)]);
    setMetas((p) => [...p, { parentExpanded: false, selectedParent: null }]);
  };

  const duplicateRow = (i: number) => {
    setRows((p) => { const n = [...p]; n.splice(i + 1, 0, { ...p[i], studentName: "", dateOfBirth: "" }); return n; });
    setMetas((p) => { const n = [...p]; n.splice(i + 1, 0, { parentExpanded: false, selectedParent: p[i].selectedParent }); return n; });
  };

  const removeRow = (i: number) => {
    if (rows.length === 1) return;
    setRows((p) => p.filter((_, x) => x !== i));
    setMetas((p) => p.filter((_, x) => x !== i));
  };

  const updateRow = <K extends keyof BulkAdmitRow>(i: number, field: K, value: BulkAdmitRow[K]) => {
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== i) return row;
        if (field === "currentGrade") {
          return { ...row, currentGrade: value as string, stream: streamsFor(value as string)[0] ?? "" };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const updateMeta = (i: number, patch: Partial<RowMeta>) => {
    setMetas((p) => p.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  };

  const selectParent = (i: number, parent: ParentSearchResult | null) => {
    updateMeta(i, { selectedParent: parent });
    setRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== i) return row;
        if (parent) return { ...row, parentMode: "existing", existingParentId: parent.id, parentName: "", parentEmail: "", parentPhone: "" };
        return { ...row, parentMode: "new", existingParentId: null };
      })
    );
  };

  // ── Stats ──────────────────────────────────────────────────────────────
  const completedCount = rows.filter((r, i) => isComplete(r, metas[i] ?? { parentExpanded: false, selectedParent: null })).length;
  const namedCount = rows.filter((r) => r.studentName.trim()).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
            <GraduationCap className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Student Batch Admission
              <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/15">
                {completedCount}/{rows.length}
              </span>
            </h2>
            <p className="text-xs text-white/30 mt-0.5">
              Expand each row to add parent · press <kbd className="px-1 py-0.5 rounded bg-white/10 font-mono text-[10px]">Esc</kbd> to close panel
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/50 hover:text-amber-400 hover:border-amber-400/25 hover:bg-amber-400/[0.03] transition-all text-xs font-bold uppercase tracking-wider"
        >
          <Plus className="h-3.5 w-3.5" /> Add Student
        </button>
      </div>

      {/* Column labels (only for the grid portion) */}
      <div className="hidden lg:grid grid-cols-[28px_1fr_144px_88px_112px_100px_104px_80px] gap-2 px-4 pb-1">
        {["#", "Student Name", "Date of Birth", "Gender", "Grade", "Stream", "Guardian", ""].map((h) => (
          <div key={h} className="text-[10px] font-bold uppercase tracking-widest text-white/20">{h}</div>
        ))}
      </div>

      {/* Row cards */}
      <div className="space-y-2.5">
        {rows.map((row, i) => {
          const meta = metas[i] ?? { parentExpanded: false, selectedParent: null };
          const complete = isComplete(row, meta);
          const hasName = row.studentName.trim().length > 0;
          const needsParent = hasName && !row.dateOfBirth === false && !complete;
          const streams = streamsFor(row.currentGrade);

          return (
            <div
              key={i}
              className={`rounded-2xl border overflow-hidden transition-all duration-200 ${
                complete
                  ? "border-emerald-500/20 bg-gradient-to-r from-emerald-500/[0.03] to-transparent"
                  : hasName
                  ? "border-amber-400/12 bg-white/[0.02]"
                  : "border-white/[0.05] bg-white/[0.01]"
              }`}
            >
              {/* ── Student data row ── */}
              <div className="px-4 py-3 flex items-center gap-2 flex-wrap lg:flex-nowrap">

                {/* Index / check */}
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold shrink-0 transition-all ${
                  complete ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.04] text-white/20"
                }`}>
                  {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>

                {/* Name */}
                <input
                  type="text"
                  placeholder="Student full name…"
                  value={row.studentName}
                  onChange={(e) => updateRow(i, "studentName", e.target.value)}
                  className="g-input flex-1 min-w-[180px] font-medium"
                  autoComplete="off"
                />

                {/* DOB */}
                <input
                  type="date"
                  aria-label="Date of birth"
                  value={row.dateOfBirth}
                  onChange={(e) => updateRow(i, "dateOfBirth", e.target.value)}
                  className="g-input w-36 shrink-0 text-xs"
                />

                {/* Gender */}
                <div className="relative w-[88px] shrink-0">
                  <select aria-label="Gender" value={row.gender} onChange={(e) => updateRow(i, "gender", e.target.value as "Male" | "Female")} className="g-input w-full appearance-none pr-5 text-xs">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
                </div>

                {/* Grade */}
                <div className="relative w-28 shrink-0">
                  <select aria-label="Grade" value={row.currentGrade} onChange={(e) => updateRow(i, "currentGrade", e.target.value)} className="g-input w-full appearance-none pr-5 text-xs text-amber-300/80">
                    {availableGrades.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-400/25" />
                </div>

                {/* Stream */}
                <div className="relative w-24 shrink-0">
                  <select aria-label="Stream" value={row.stream} onChange={(e) => updateRow(i, "stream", e.target.value)} className="g-input w-full appearance-none pr-5 text-xs text-amber-200/50">
                    {streams.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-amber-400/15" />
                </div>

                {/* Parent expand toggle */}
                <button
                  type="button"
                  onClick={() => updateMeta(i, { parentExpanded: !meta.parentExpanded })}
                  onKeyDown={(e) => e.key === "Escape" && updateMeta(i, { parentExpanded: false })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 border ${
                    meta.parentExpanded
                      ? "bg-amber-400/12 text-amber-300 border-amber-400/25"
                      : complete
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                      : needsParent
                      ? "bg-amber-400/8 text-amber-400/70 border-amber-400/20 animate-pulse"
                      : "bg-white/[0.03] text-white/35 border-white/[0.07] hover:text-white/60 hover:border-white/15"
                  }`}
                  aria-expanded={meta.parentExpanded}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>
                    {meta.selectedParent
                      ? meta.selectedParent.full_name.split(" ")[0]
                      : row.parentEmail?.split("@")[0] || "Parent"}
                  </span>
                  {meta.parentExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => duplicateRow(i)} title="Duplicate row" aria-label="Duplicate" className="p-1.5 rounded-lg text-white/15 hover:text-amber-400 hover:bg-amber-400/10 transition-all">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" onClick={() => removeRow(i)} aria-label="Remove row" className="p-1.5 rounded-lg text-white/15 hover:text-rose-400 hover:bg-rose-400/10 transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline nudge */}
              {!meta.parentExpanded && hasName && !complete && (
                <div className="px-4 pb-3 flex items-center gap-2 ml-9">
                  <AlertCircle className="h-3 w-3 text-amber-400/40 shrink-0" />
                  <button type="button" onClick={() => updateMeta(i, { parentExpanded: true })} className="text-[11px] text-amber-400/50 hover:text-amber-400 transition-colors">
                    Parent / guardian info required — click to add
                  </button>
                </div>
              )}

              {/* ── Parent panel ── */}
              {meta.parentExpanded && (
                <div className="border-t border-white/[0.05] bg-white/[0.015] px-4 py-4 ml-0">
                  <div className="ml-9 space-y-4">

                    {/* Mode + Relationship in one row */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[10px] text-white/30 font-bold uppercase tracking-wider">Parent:</span>

                      {/* Mode buttons */}
                      <div className="flex bg-white/[0.04] rounded-lg border border-white/[0.06] p-0.5">
                        <button
                          type="button"
                          onClick={() => { updateRow(i, "parentMode", "new"); selectParent(i, null); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${row.parentMode === "new" ? "bg-amber-400 text-[#0c0f1a]" : "text-white/35 hover:text-white/60"}`}
                        >
                          <UserPlus className="h-3 w-3" /> New
                        </button>
                        <button
                          type="button"
                          onClick={() => updateRow(i, "parentMode", "existing")}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${row.parentMode === "existing" ? "bg-amber-400 text-[#0c0f1a]" : "text-white/35 hover:text-white/60"}`}
                        >
                          <UserCheck className="h-3 w-3" /> Existing
                        </button>
                      </div>

                      {/* Relationship type */}
                      <div className="flex items-center gap-2 ml-auto">
                        <span className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Relationship:</span>
                        <div className="relative">
                          <select
                          
                            value={row.relationshipType}
                            onChange={(e) => updateRow(i, "relationshipType", e.target.value as BulkAdmitRow["relationshipType"])}
                            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white/70 appearance-none pr-6 focus:outline-none focus:border-amber-400/40 cursor-pointer"
                          >
                            {RELATIONSHIP_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/25" />
                        </div>
                      </div>
                    </div>

                    {/* Existing parent search */}
                    {row.parentMode === "existing" && (
                      <div className="space-y-2">
                        <ParentSearch selected={meta.selectedParent} onSelect={(p) => selectParent(i, p)} />
                        {!meta.selectedParent && (
                          <p className="text-[11px] text-white/25 flex items-center gap-1.5">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            Search by name, email or phone. Selecting here links this student to their existing account.
                          </p>
                        )}
                      </div>
                    )}

                    {/* New parent fields */}
                    {row.parentMode === "new" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex items-center gap-1">
                              <User className="h-3 w-3" /> Full Name *
                            </label>
                            <input
                              type="text"
                              placeholder="Parent / guardian name"
                              value={row.parentName ?? ""}
                              onChange={(e) => updateRow(i, "parentName", e.target.value)}
                              className="p-input w-full"
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex items-center gap-1">
                              <Mail className="h-3 w-3" /> Email Address *
                            </label>
                            <input
                              type="email"
                              placeholder="parent@email.com"
                              value={row.parentEmail ?? ""}
                              onChange={(e) => updateRow(i, "parentEmail", e.target.value)}
                              className="p-input w-full"
                              autoComplete="off"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex items-center gap-1">
                              <Phone className="h-3 w-3" /> Phone Number *
                            </label>
                            <input
                              type="tel"
                              placeholder="+254 7XX XXX XXX"
                              value={row.parentPhone ?? ""}
                              onChange={(e) => updateRow(i, "parentPhone", e.target.value)}
                              className="p-input w-full"
                              autoComplete="off"
                            />
                          </div>
                        </div>

                        <p className="text-[11px] text-white/20 flex items-center gap-1.5 leading-relaxed">
                          <AlertCircle className="h-3 w-3 shrink-0 text-white/25" />
                          A welcome email with account setup link will be sent to the parent. If a parent with this email or phone already exists, the student is automatically linked — no duplicate created.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add row CTA */}
      <button
        type="button"
        onClick={addRow}
        className="w-full py-3.5 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.07] hover:border-amber-400/20 text-white/20 hover:text-amber-400/60 hover:bg-amber-400/[0.02] transition-all text-xs font-medium tracking-wide"
      >
        <Plus className="h-3.5 w-3.5" /> Add another student
      </button>

      {/* Progress */}
      {rows.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-white/25">
            <span>{completedCount} of {rows.length} complete</span>
            {namedCount > completedCount && (
              <span className="text-amber-400/40">{namedCount - completedCount} missing parent info</span>
            )}
          </div>
          <div className="h-0.5 rounded-full bg-white/[0.05] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-500"
              style={{ width: `${rows.length ? (completedCount / rows.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-white/30">
          {completedCount > 0
            ? `${completedCount} student${completedCount > 1 ? "s" : ""} ready — parent accounts will be created and invited`
            : "Fill in student details and expand to add parent info"}
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || completedCount === 0}
          className="flex items-center gap-2.5 bg-amber-400 disabled:bg-white/[0.06] text-[#0c0f1a] font-bold px-8 py-3.5 rounded-xl hover:bg-amber-300 active:scale-[0.97] transition-all shadow-lg shadow-amber-400/15 disabled:text-white/15 disabled:shadow-none text-sm"
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
          ) : (
            <><Save className="h-4 w-4" /> Admit {completedCount || ""} Student{completedCount !== 1 ? "s" : ""}</>
          )}
        </button>
      </div>

      {/* Shared styles */}
      <style>{`
        .g-input {
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          padding: 6px 10px;
          color: rgba(255,255,255,0.82);
          font-size: 13px;
          outline: none;
          transition: border-color .12s, background .12s;
        }
        .g-input::placeholder { color: rgba(255,255,255,0.18); }
        .g-input:hover { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.025); }
        .g-input:focus { border-color: rgba(251,191,36,.45); background: rgba(251,191,36,.04); box-shadow: 0 0 0 3px rgba(251,191,36,.06); }
        .g-input option { background: #0c0f1a; }
        input[type="date"].g-input::-webkit-calendar-picker-indicator { filter: invert(0.35); cursor: pointer; }

        .p-input {
          background: rgba(255,255,255,.035);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 10px;
          padding: 8px 12px;
          color: rgba(255,255,255,.82);
          font-size: 13px;
          outline: none;
          transition: border-color .12s, background .12s;
        }
        .p-input::placeholder { color: rgba(255,255,255,.18); }
        .p-input:hover { border-color: rgba(255,255,255,.12); }
        .p-input:focus { border-color: rgba(251,191,36,.4); background: rgba(251,191,36,.04); box-shadow: 0 0 0 3px rgba(251,191,36,.06); outline: none; }
        .p-input option { background: #0c0f1a; }
      `}</style>
    </div>
  );
}