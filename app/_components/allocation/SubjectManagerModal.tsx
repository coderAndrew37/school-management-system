"use client";

// app/_components/allocation/SubjectManagerModal.tsx
// Full CRUD for CBC subjects. Opens as a modal from the allocation page.
// Subjects are grouped by level. Admin can add, edit, and delete.

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  Edit2,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
  BookMarked,
} from "lucide-react";
import {
  createSubjectAction,
  updateSubjectAction,
  deleteSubjectAction,
} from "@/lib/actions/subjects";
import type { Subject, SubjectLevel } from "@/lib/types/allocation";

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVELS: {
  value: SubjectLevel;
  label: string;
  color: string;
  bg: string;
  border: string;
}[] = [
  {
    value: "lower_primary",
    label: "Lower Primary",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
  },
  {
    value: "upper_primary",
    label: "Upper Primary",
    color: "text-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/30",
  },
  {
    value: "junior_secondary",
    label: "Junior Secondary",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
  },
];

const levelStyle = (level: SubjectLevel) =>
  LEVELS.find((l) => l.value === level) ?? LEVELS[1]!;

// ── Subject form (shared for add + edit) ──────────────────────────────────────

interface SubjectFormState {
  name: string;
  code: string;
  level: SubjectLevel;
  weekly_lessons: number;
}

const DEFAULT_FORM: SubjectFormState = {
  name: "",
  code: "",
  level: "upper_primary",
  weekly_lessons: 5,
};

function SubjectForm({
  initial,
  onSave,
  onCancel,
  saving,
  submitLabel = "Add Subject",
}: {
  initial: SubjectFormState;
  onSave: (form: SubjectFormState) => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel?: string;
}) {
  const [form, setForm] = useState<SubjectFormState>(initial);

  const update = <K extends keyof SubjectFormState>(
    k: K,
    v: SubjectFormState[K],
  ) => setForm((prev) => ({ ...prev, [k]: v }));

  const handleNameBlur = () => {
    // Auto-generate code from name if code is still empty
    if (!form.code.trim() && form.name.trim()) {
      const code = form.name
        .toUpperCase()
        .replace(/&/g, "AND")
        .replace(/[^A-Z0-9 ]/g, "")
        .split(" ")
        .filter(Boolean)
        .map((w) => w.slice(0, 3))
        .join("-")
        .slice(0, 16);
      update("code", code);
    }
  };

  const input =
    "w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20 transition-all";
  const select = input + " appearance-none cursor-pointer";

  return (
    <div className="space-y-3">
      {/* Name */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5">
          Subject Name *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          onBlur={handleNameBlur}
          placeholder="e.g. Integrated Science"
          className={input}
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Code */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5">
            Code *
          </label>
          <input
            type="text"
            value={form.code}
            onChange={(e) => update("code", e.target.value.toUpperCase())}
            placeholder="e.g. INT-SCI"
            maxLength={20}
            className={input + " font-mono"}
            disabled={saving}
          />
        </div>

        {/* Weekly lessons */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5">
            Lessons/Week *
          </label>
          <input
            aria-label="lessons per week"
            type="number"
            min={1}
            max={10}
            value={form.weekly_lessons}
            onChange={(e) =>
              update("weekly_lessons", parseInt(e.target.value, 10) || 1)
            }
            className={input}
            disabled={saving}
          />
        </div>
      </div>

      {/* Level */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5">
          Level *
        </label>
        <div className="relative">
          <select
            value={form.level}
            onChange={(e) => update("level", e.target.value as SubjectLevel)}
            className={select}
            disabled={saving}
            aria-label="subject level"
          >
            {LEVELS.map((l) => (
              <option key={l.value} value={l.value} className="bg-[#0c0f1a]">
                {l.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        </div>
      </div>

      {/* Level preview badge */}
      {(() => {
        const ls = levelStyle(form.level);
        return (
          <div
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${ls.color} ${ls.bg} ${ls.border}`}
          >
            <BookOpen className="h-3 w-3" />
            {ls.label} · {form.weekly_lessons} lesson
            {form.weekly_lessons !== 1 ? "s" : ""}/week
          </div>
        );
      })()}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-white/40 hover:text-white/70 hover:border-white/20 transition-all"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim() || !form.code.trim()}
          className="flex-[2] flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-xs font-bold text-[#0c0f1a] transition-all"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  subjects: Subject[];
}

export function SubjectManagerModal({ subjects }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [filterLevel, setFilterLevel] = useState<SubjectLevel | "all">("all");
  const [confirmDel, setConfirmDel] = useState<Subject | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered =
    filterLevel === "all"
      ? subjects
      : subjects.filter((s) => s.level === filterLevel);

  const byLevel = LEVELS.map((l) => ({
    ...l,
    subjects: filtered.filter((s) => s.level === l.value),
  }));

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAdd = (form: SubjectFormState) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", form.name.trim());
      fd.set("code", form.code.trim());
      fd.set("level", form.level);
      fd.set("weekly_lessons", String(form.weekly_lessons));
      const result = await createSubjectAction(fd);
      if (result.success) {
        toast.success(result.message);
        setMode("list");
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleEdit = (form: SubjectFormState) => {
    if (!editTarget) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", form.name.trim());
      fd.set("code", form.code.trim());
      fd.set("level", form.level);
      fd.set("weekly_lessons", String(form.weekly_lessons));
      const result = await updateSubjectAction(editTarget.id, fd);
      if (result.success) {
        toast.success(result.message);
        setMode("list");
        setEditTarget(null);
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleDelete = (subject: Subject) => {
    startTransition(async () => {
      const result = await deleteSubjectAction(subject.id);
      if (result.success) {
        toast.success(result.message);
        setConfirmDel(null);
      } else {
        toast.error(result.message);
      }
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => {
          setOpen(true);
          setMode("list");
        }}
        className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 px-3.5 py-2 text-xs font-semibold text-white/60 hover:text-white transition-all"
      >
        <BookMarked className="h-4 w-4" />
        Manage Subjects
        <span className="ml-1 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/40">
          {subjects.length}
        </span>
      </button>

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-white/[0.09] bg-[#0f1223] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
                  <BookMarked className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {mode === "add"
                      ? "Add New Subject"
                      : mode === "edit"
                        ? "Edit Subject"
                        : "CBC Subjects"}
                  </p>
                  <p className="text-[10px] text-white/30">
                    {mode === "list"
                      ? `${subjects.length} subjects across all levels`
                      : "Fill in the details below"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="close"
                className="rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/[0.07] transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ── ADD form ── */}
              {mode === "add" && (
                <SubjectForm
                  initial={DEFAULT_FORM}
                  onSave={handleAdd}
                  onCancel={() => setMode("list")}
                  saving={isPending}
                  submitLabel="Add Subject"
                />
              )}

              {/* ── EDIT form ── */}
              {mode === "edit" && editTarget && (
                <SubjectForm
                  initial={{
                    name: editTarget.name,
                    code: editTarget.code,
                    level: editTarget.level,
                    weekly_lessons: editTarget.weekly_lessons,
                  }}
                  onSave={handleEdit}
                  onCancel={() => {
                    setMode("list");
                    setEditTarget(null);
                  }}
                  saving={isPending}
                  submitLabel="Save Changes"
                />
              )}

              {/* ── LIST ── */}
              {mode === "list" && (
                <div className="space-y-5">
                  {/* Level filter + add button */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {(
                      [
                        { value: "all", label: "All" },
                        ...LEVELS.map((l) => ({
                          value: l.value,
                          label: l.label,
                        })),
                      ] as { value: SubjectLevel | "all"; label: string }[]
                    ).map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setFilterLevel(f.value)}
                        className={[
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                          filterLevel === f.value
                            ? "bg-amber-400/15 border-amber-400/35 text-amber-400"
                            : "bg-white/[0.02] border-white/[0.07] text-white/35 hover:text-white/65 hover:border-white/[0.14]",
                        ].join(" ")}
                      >
                        {f.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setMode("add")}
                      className="ml-auto flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 px-4 py-1.5 text-xs font-bold text-[#0c0f1a] transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Subject
                    </button>
                  </div>

                  {/* Subject list grouped by level */}
                  {filtered.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
                      <p className="text-3xl mb-2">📚</p>
                      <p className="text-white/30 text-sm">
                        No subjects found.
                      </p>
                      <button
                        onClick={() => setMode("add")}
                        className="mt-3 text-xs text-amber-400/70 hover:text-amber-400"
                      >
                        Add the first subject →
                      </button>
                    </div>
                  ) : (
                    byLevel.map((group) => {
                      if (group.subjects.length === 0) return null;
                      return (
                        <div key={group.value}>
                          <div
                            className={`flex items-center gap-2 mb-2 rounded-lg border px-3 py-1.5 w-fit ${group.bg} ${group.border}`}
                          >
                            <span
                              className={`text-[10px] font-black uppercase tracking-widest ${group.color}`}
                            >
                              {group.label}
                            </span>
                            <span
                              className={`text-[10px] font-bold ${group.color} opacity-60`}
                            >
                              {group.subjects.length}
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {group.subjects.map((subject) => (
                              <div
                                key={subject.id}
                                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 group/row hover:bg-white/[0.04] transition-all"
                              >
                                {/* Code badge */}
                                <span
                                  className={`shrink-0 text-[10px] font-bold font-mono px-2 py-1 rounded-lg border ${group.bg} ${group.color} ${group.border}`}
                                >
                                  {subject.code}
                                </span>

                                {/* Name + meta */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-white/80 truncate">
                                    {subject.name}
                                  </p>
                                  <p className="text-[10px] text-white/30">
                                    {subject.weekly_lessons} lesson
                                    {subject.weekly_lessons !== 1 ? "s" : ""}
                                    /week
                                  </p>
                                </div>

                                {/* Actions — visible on hover */}
                                <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditTarget(subject);
                                      setMode("edit");
                                    }}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-400/10 transition-all"
                                    title="Edit subject"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDel(subject)}
                                    className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                                    title="Delete subject"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Footer (list mode only) */}
            {mode === "list" && (
              <div className="px-6 py-3 border-t border-white/[0.06] shrink-0">
                <p className="text-[10px] text-white/20 text-center">
                  Changes take effect immediately on the allocation page.
                  Subjects in use by existing allocations cannot be deleted.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmDel(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/[0.09] bg-[#0f1223] p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">
              Delete subject?
            </h3>
            <p className="text-xs text-white/40 mb-1">
              <span className="font-mono text-white/60">{confirmDel.code}</span>{" "}
              — {confirmDel.name}
            </p>
            <p className="text-xs text-rose-400/80 mb-5">
              This cannot be undone. The subject will be removed from the
              system. If it is assigned to any teacher, deletion will be
              blocked.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDel(null)}
                disabled={isPending}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-white/40 hover:text-white/70 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDel)}
                disabled={isPending}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-50 py-2.5 text-xs font-bold text-white transition-all"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
