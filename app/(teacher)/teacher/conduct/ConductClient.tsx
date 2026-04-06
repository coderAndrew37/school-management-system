"use client";

import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Shield } from "lucide-react";

import {
  createConductRecordAction,
  deleteConductRecordAction,
  notifyParentConductAction,
  updateConductRecordAction,
  type ConductRecord,
} from "@/lib/actions/conduct";
import type { ClassStudent } from "@/lib/data/assessment";
import {
  type ActionState,
  type ConductCategory,
  type ConductType,
  type Severity,
} from "@/lib/schemas/conduct";

import { ConductStats } from "./_components/ConductStats";
import { ConductForm, type ClassInfo } from "./_components/ConductForm";
import { ConductFeed } from "./_components/ConductFeed";
import {
  LeaderboardEntry,
  ConductLeaderboard,
} from "./_components/ConductLeaderboard";

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  teacherName: string;
  classes: ClassInfo[];
  studentsByClass: Record<string, ClassStudent[]>;
  initialRecords: ConductRecord[];
  term: number;
  academicYear: number;
}

const INITIAL_STATE: ActionState = { status: "idle" };

// ── Component ─────────────────────────────────────────────────────────────────

export function ConductClient({
  teacherName,
  classes,
  studentsByClass,
  initialRecords,
  term,
  academicYear,
}: Props) {
  // ── Records ──────────────────────────────────────────────────────────────
  const [records, setRecords] = useState<ConductRecord[]>(initialRecords);

  // ── Form panel visibility ────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);

  // ── Form controlled state ────────────────────────────────────────────────
  const [selectedClass, setSelectedClass] = useState<ClassInfo | null>(
    classes[0] ?? null,
  );
  const [selectedType, setSelectedType] = useState<ConductType>("merit");
  const [selectedCategory, setSelectedCategory] =
    useState<ConductCategory>("behaviour");
  const [selectedSeverity, setSelectedSeverity] = useState<Severity>("low");
  const [points, setPoints] = useState(1);

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const formRef = useRef<HTMLFormElement>(null);

  // ── Server action state ───────────────────────────────────────────────────
  const [state, formAction, isSubmitting] = useActionState<
    ActionState,
    FormData
  >(createConductRecordAction, INITIAL_STATE);

  // ── Secondary mutations ───────────────────────────────────────────────────
  const [isMutating, startMutation] = useTransition();

  // ── React to action state ─────────────────────────────────────────────────
  useEffect(() => {
    if (state.status === "idle") return;

    if (state.status === "error") {
      if (Object.keys(state.fieldErrors || {}).length === 0) {
        flash(state.message || "An error occurred", false);
      }
      return;
    }

    if (state.status === "success") {
      flash(state.message || "Success", true);

      const d = state.data;
      if (d) {
        const optimistic: ConductRecord = {
          id: state.id || Math.random().toString(),
          student_id: d.student_id,
          student_name: state.studentName || "Unknown Student",
          teacher_id: "",
          grade: d.grade,
          stream: d.stream,
          academic_year: d.academic_year,
          term: d.term,
          type: d.type,
          category: d.category,
          points:
            d.type === "merit"
              ? Math.abs(d.points)
              : d.type === "demerit"
                ? -Math.abs(d.points)
                : 0,
          description: d.description,
          action_taken: d.action_taken ?? null,
          parent_notified: false,
          parent_ack_at: null,
          severity: d.type === "incident" ? (d.severity ?? "low") : null,
          is_resolved: false,
          created_at: new Date().toISOString(),
        };

        setRecords((prev) => [optimistic, ...prev]);
      }

      formRef.current?.reset();
      setSelectedType("merit");
      setSelectedCategory("behaviour");
      setSelectedSeverity("low");
      setPoints(1);
      setShowForm(false);
    }
  }, [state]);

  // ── Mutation handlers ─────────────────────────────────────────────────────

  function flash(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function handleNotify(id: string) {
    startMutation(async () => {
      const res = await notifyParentConductAction(id);
      if (res.success) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, parent_notified: true } : r)),
        );
        flash("Parent notified.", true);
      } else {
        flash(res.message, false);
      }
    });
  }

  function handleDelete(id: string) {
    startMutation(async () => {
      const res = await deleteConductRecordAction(id);
      if (res.success) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        flash("Record deleted.", true);
      } else {
        flash(res.message, false);
      }
    });
  }

  function handleResolve(id: string) {
    startMutation(async () => {
      const res = await updateConductRecordAction(id, { is_resolved: true });
      if (res.success) {
        setRecords((prev) =>
          prev.map((r) => (r.id === id ? { ...r, is_resolved: true } : r)),
        );
        flash("Marked as resolved.", true);
      } else {
        flash(res.message, false);
      }
    });
  }

  // ── Derived / memoised ────────────────────────────────────────────────────

  // Now using selectedClass.id (UUID) to lookup from the map
  const students = useMemo(
    () => (selectedClass ? (studentsByClass[selectedClass.id] ?? []) : []),
    [selectedClass, studentsByClass],
  );

  const stats = useMemo(
    () => ({
      totalPoints: records.reduce((s, r) => s + r.points, 0),
      meritCount: records.filter((r) => r.type === "merit").length,
      demeritCount: records.filter((r) => r.type === "demerit").length,
      incidentCount: records.filter(
        (r) => r.type === "incident" && !r.is_resolved,
      ).length,
    }),
    [records],
  );

  const leaderboardEntries = useMemo((): LeaderboardEntry[] => {
    const totals = new Map<
      string,
      { name: string; pts: number; grade: string; stream: string }
    >();
    for (const r of records) {
      const cur = totals.get(r.student_id) ?? {
        name: r.student_name,
        pts: 0,
        grade: r.grade,
        stream: r.stream,
      };
      cur.pts += r.points;
      totals.set(r.student_id, cur);
    }
    return [...totals.entries()]
      .sort(([, a], [, b]) => b.pts - a.pts)
      .slice(0, 5)
      .map(([studentId, { name, pts, grade, stream }]) => ({
        studentId,
        name,
        pts,
        grade,
        stream,
      }));
  }, [records]);

  const uniqueGrades = useMemo(
    () => [...new Set(records.map((r) => r.grade))].sort(),
    [records],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Shield className="h-5 w-5 text-violet-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-slate-800 leading-none">
              Conduct & Merits
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {teacherName} · Term {term} {academicYear}
            </p>
          </div>
          <Link
            href="/teacher"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Log Record
          </button>
        </div>
      </header>

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-xl ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        <ConductStats {...stats} />

        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
          <div className="space-y-4">
            {showForm && (
              <ConductForm
                formRef={formRef}
                formAction={formAction}
                isSubmitting={isSubmitting}
                state={state}
                selectedType={selectedType}
                onTypeChange={setSelectedType}
                selectedClass={selectedClass}
                onClassChange={setSelectedClass}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedSeverity={selectedSeverity}
                onSeverityChange={setSelectedSeverity}
                points={points}
                onPointsChange={setPoints}
                classes={classes}
                students={students}
                records={records}
                academicYear={academicYear}
                term={term}
                onCancel={() => setShowForm(false)}
              />
            )}

            <ConductLeaderboard entries={leaderboardEntries} />
          </div>

          <ConductFeed
            records={records}
            grades={uniqueGrades}
            totalRecordCount={records.length}
            isMutating={isMutating}
            onNotify={handleNotify}
            onDelete={handleDelete}
            onResolve={handleResolve}
          />
        </div>
      </div>
    </div>
  );
}
