"use client";

// app/admin/fees/_components/FeesAdminClient.tsx

import {
  bulkGenerateFeeRecordsAction,
  deleteFeeStructureAction,
  recordPaymentAction,
  searchStudentsForFees,
  upsertFeeStructureAction,
  type FeeRecord,
  type FeeStructure,
  type GradeFeeStats,
} from "@/lib/actions/fees";

import {
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";

const GRADES = [
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7 / JSS 1",
  "Grade 8 / JSS 2",
  "Grade 9 / JSS 3",
];
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

function kes(n: number) {
  return (
    "KES " +
    n.toLocaleString("en-KE", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    partial: "bg-sky-50 text-sky-700 border-sky-200",
    waived: "bg-slate-50 text-slate-500 border-slate-200",
  };
  return (
    <span
      className={`text-[10px] font-black px-2 py-0.5 rounded-lg border capitalize ${map[status] ?? map.pending}`}
      aria-label={`Status: ${status}`}
    >
      {status}
    </span>
  );
}

// ── Record Payment Modal ──────────────────────────────────────────────────────
function RecordPaymentModal({
  onClose,
  onSuccess,
  academic_year,
}: {
  onClose: () => void;
  onSuccess: () => void;
  academic_year: number;
}) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [term, setTerm] = useState(1);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [isPending, startTrans] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setStudents([]);
      return;
    }
    setSearching(true);
    const res = await searchStudentsForFees(q);
    setStudents(res);
    setSearching(false);
  }, []);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(e.target.value), 300);
  };

  function handleSubmit() {
    if (!selected) {
      setError("Select a student");
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setError(null);
    startTrans(async () => {
      const res = await recordPaymentAction({
        student_id: selected.id,
        term,
        academic_year,
        amount: parseFloat(amount),
        payment_method: method,
        reference_number: reference || undefined,
        notes: notes || undefined,
        paid_at: paidAt,
      });
      if (res.success) onSuccess();
      else setError(res.error ?? "Failed to record payment");
    });
  }

  const inputCls =
    "w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-emerald-600 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-black text-base">Record Payment</p>
            <p className="text-emerald-100 text-xs mt-0.5">
              Mark fee as paid — admin only
            </p>
          </div>
          <button
            aria-label="close "
            onClick={onClose}
            className="text-emerald-100 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Student search */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
              Student
            </label>
            {selected ? (
              <div className="flex items-center gap-3 border border-emerald-200 bg-emerald-50 rounded-xl px-3 py-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                  {selected.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {selected.full_name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {selected.current_grade}
                  </p>
                </div>
                <button
                  aria-label="Remove student"
                  onClick={() => {
                    setSelected(null);
                    setStudents([]);
                    setQuery("");
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={handleQueryChange}
                  placeholder="Search student name or ID…"
                  className={`${inputCls} pl-9`}
                  autoFocus
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
                )}
                {students.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                    {students.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelected(s);
                          setStudents([]);
                          setQuery("");
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50 last:border-0"
                      >
                        <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600">
                          {s.full_name
                            .split(" ")
                            .slice(0, 2)
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            {s.full_name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {s.current_grade}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Term + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                Term
              </label>
              <select
                aria-label="filter by term"
                value={term}
                onChange={(e) => setTerm(parseInt(e.target.value))}
                className={inputCls}
              >
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                Amount (KES)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min="0"
                className={inputCls}
              />
            </div>
          </div>

          {/* Method + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                Method
              </label>
              <select
                aria-label="select payment method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={inputCls}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                Date Paid
              </label>
              <input
                aria-label="enter date paid"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className={`${inputCls} [color-scheme:light]`}
              />
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
              Reference / Transaction ID{" "}
              <span className="normal-case text-slate-400 font-normal">
                (optional)
              </span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. MPESA QXYZ1234"
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
              Notes{" "}
              <span className="normal-case text-slate-400 font-normal">
                (optional)
              </span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Record Payment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bulk Generate Modal ───────────────────────────────────────────────────────
function BulkGenerateModal({
  onClose,
  onSuccess,
  academic_year,
}: {
  onClose: () => void;
  onSuccess: (msg: string) => void;
  academic_year: number;
}) {
  const [grade, setGrade] = useState("");
  const [term, setTerm] = useState(1);
  const [isPending, startTrans] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    if (!grade) {
      setError("Select a grade");
      return;
    }
    setError(null);
    startTrans(async () => {
      const res = await bulkGenerateFeeRecordsAction(
        grade,
        term,
        academic_year,
      );
      if (res.success)
        onSuccess(
          `Created ${res.created} records, ${res.skipped} already existed`,
        );
      else setError(res.error ?? "Failed");
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-sky-600 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-white font-black text-base">
              Bulk Generate Fees
            </p>
            <p className="text-sky-100 text-xs mt-0.5">
              Creates pending fee records for all students in a grade
            </p>
          </div>
          <button
            aria-label="close "
            onClick={onClose}
            className="text-sky-100 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
              Grade
            </label>
            <select
              aria-label="select grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="">Select grade…</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
              Term
            </label>
            <select
              aria-label="Filter by term"
              value={term}
              onChange={(e) => setTerm(parseInt(e.target.value))}
              className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
          {error && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || !grade}
              className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main client ───────────────────────────────────────────────────────────────
interface Props {
  structures: FeeStructure[];
  records: FeeRecord[];
  stats: {
    totalCollected: number;
    totalOutstanding: number;
    totalStudents: number;
    paidCount: number;
    pendingCount: number;
    gradeBreakdown: GradeFeeStats[];
  };
  academic_year: number;
}

export function FeesAdminClient({
  structures,
  records,
  stats,
  academic_year,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "payments" | "structures"
  >("dashboard");
  const [showPayModal, setPayModal] = useState(false);
  const [showBulkModal, setBulkModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [filterGrade, setFilterGrade] = useState("");
  const [filterTerm, setFilterTerm] = useState(0);
  const [search, setSearch] = useState("");
  const [isPending, startTrans] = useTransition();

  // Fee structure form state
  const [structGrade, setStructGrade] = useState("");
  const [structTerm, setStructTerm] = useState(1);
  const [structAmount, setStructAmount] = useState("");
  const [structDesc, setStructDesc] = useState("");

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function handleSaveStructure() {
    if (!structGrade || !structAmount) return;
    startTrans(async () => {
      const res = await upsertFeeStructureAction({
        grade: structGrade,
        term: structTerm,
        academic_year,
        amount: parseFloat(structAmount),
        description: structDesc || undefined,
      });
      if (res.success) {
        showToast("Fee structure saved", true);
        setStructGrade("");
        setStructAmount("");
        setStructDesc("");
      } else showToast(res.error ?? "Failed", false);
    });
  }

  function handleDeleteStructure(id: string) {
    startTrans(async () => {
      const res = await deleteFeeStructureAction(id);
      if (res.success) showToast("Deleted", true);
      else showToast(res.error ?? "Failed", false);
    });
  }

  const filteredRecords = records.filter((r) => {
    if (filterGrade && r.grade !== filterGrade) return false;
    if (filterTerm && r.term !== filterTerm) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.student_name.toLowerCase().includes(q) &&
        !r.grade.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const collectRate =
    stats.totalStudents > 0
      ? Math.round(
          (stats.paidCount / (stats.paidCount + stats.pendingCount || 1)) * 100,
        )
      : 0;

  const inputCls =
    "text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-400";

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 ${toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"}`}
        >
          {toast.ok && <Check className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {showPayModal && (
        <RecordPaymentModal
          academic_year={academic_year}
          onClose={() => setPayModal(false)}
          onSuccess={() => {
            setPayModal(false);
            showToast("Payment recorded", true);
          }}
        />
      )}
      {showBulkModal && (
        <BulkGenerateModal
          academic_year={academic_year}
          onClose={() => setBulkModal(false)}
          onSuccess={(msg) => {
            setBulkModal(false);
            showToast(msg, true);
          }}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Wallet className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">Fee Management</p>
            <p className="text-[10px] text-slate-400 font-semibold">
              Academic Year {academic_year} · Admin only
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Bulk Generate
            </button>
            <button
              onClick={() => setPayModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Record Payment
            </button>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-0">
          {(
            [
              { key: "dashboard", label: "Dashboard", icon: BarChart3 },
              { key: "payments", label: "Payment Records", icon: CheckCircle2 },
              { key: "structures", label: "Fee Structures", icon: Building2 },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
                activeTab === key
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* ── DASHBOARD TAB ─────────────────────────────────────────────────── */}
        {activeTab === "dashboard" && (
          <>
            {/* Summary metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Total Collected",
                  value: kes(stats.totalCollected),
                  cls: "text-emerald-700",
                  bg: "bg-emerald-50 border-emerald-200",
                  icon: CheckCircle2,
                },
                {
                  label: "Outstanding",
                  value: kes(stats.totalOutstanding),
                  cls:
                    stats.totalOutstanding > 0
                      ? "text-amber-700"
                      : "text-slate-400",
                  bg:
                    stats.totalOutstanding > 0
                      ? "bg-amber-50 border-amber-200"
                      : "bg-slate-50 border-slate-200",
                  icon: Clock,
                },
                {
                  label: "Paid Records",
                  value: String(stats.paidCount),
                  cls: "text-sky-700",
                  bg: "bg-sky-50 border-sky-200",
                  icon: CheckCircle2,
                },
                {
                  label: "Collection Rate",
                  value: `${collectRate}%`,
                  cls: "text-slate-700",
                  bg: "bg-white border-slate-200",
                  icon: BarChart3,
                },
              ].map(({ label, value, cls, bg, icon: Icon }) => (
                <div
                  key={label}
                  className={`rounded-2xl border p-4 shadow-sm ${bg}`}
                >
                  <p
                    className={`text-[10px] font-black uppercase tracking-widest mb-1 opacity-70 ${cls}`}
                  >
                    {label}
                  </p>
                  <p className={`text-2xl font-black tabular-nums ${cls}`}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Collection rate bar */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-slate-800">
                  Collection Progress
                </p>
                <span className="text-xs font-bold text-slate-500">
                  {stats.paidCount} of {stats.paidCount + stats.pendingCount}{" "}
                  records paid
                </span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${collectRate}%` }}
                />
              </div>
            </div>

            {/* Grade breakdown */}
            {stats.gradeBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <p className="text-sm font-black text-slate-800">
                    By Grade & Term
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: "600px" }}>
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {[
                          "Grade",
                          "Term",
                          "Paid",
                          "Pending",
                          "Collected",
                          "Outstanding",
                          "Rate",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stats.gradeBreakdown.map((row) => {
                        const total = row.paid_count + row.pending_count;
                        const rate =
                          total > 0
                            ? Math.round((row.paid_count / total) * 100)
                            : 0;
                        return (
                          <tr
                            key={`${row.grade}-${row.term}`}
                            className="border-b border-slate-50 hover:bg-slate-50/50"
                          >
                            <td className="px-4 py-2.5 text-sm font-bold text-slate-700">
                              {row.grade}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-slate-500">
                              T{row.term}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs font-black text-emerald-600">
                                {row.paid_count}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs font-black text-amber-600">
                                {row.pending_count}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs font-bold text-slate-700">
                              {kes(row.total_collected)}
                            </td>
                            <td className="px-4 py-2.5 text-xs font-bold text-slate-500">
                              {kes(row.total_outstanding)}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full"
                                    style={{ width: `${rate}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">
                                  {rate}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── PAYMENTS TAB ──────────────────────────────────────────────────── */}
        {activeTab === "payments" && (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student name…"
                  className={`${inputCls} pl-8 w-full`}
                />
              </div>
              <select
                aria-label="Filter by grade"
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className={inputCls}
              >
                <option value="">All grades</option>
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by term"
                value={filterTerm}
                onChange={(e) => setFilterTerm(parseInt(e.target.value))}
                className={inputCls}
              >
                <option value={0}>All terms</option>
                <option value={1}>Term 1</option>
                <option value={2}>Term 2</option>
                <option value={3}>Term 3</option>
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {filteredRecords.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-3xl mb-2">💳</p>
                  <p className="text-slate-500 font-semibold">
                    No payment records match this filter
                  </p>
                  <button
                    onClick={() => setPayModal(true)}
                    className="mt-4 text-xs font-bold text-emerald-600 border border-emerald-200 bg-emerald-50 px-4 py-2 rounded-xl hover:bg-emerald-100 transition-colors"
                  >
                    Record a payment
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: "700px" }}>
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {[
                          "Student",
                          "Grade",
                          "T",
                          "Amount",
                          "Method",
                          "Reference",
                          "Paid On",
                          "Status",
                        ].map((h) => (
                          <th
                            key={h}
                            className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r) => (
                        <tr
                          key={r.id}
                          className="border-b border-slate-50 hover:bg-slate-50/50"
                        >
                          <td className="px-4 py-3 text-sm font-bold text-slate-800">
                            {r.student_name}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {r.grade}
                          </td>
                          <td className="px-4 py-3 text-xs font-bold text-slate-600">
                            T{r.term}
                          </td>
                          <td className="px-4 py-3 text-sm font-black text-slate-800 tabular-nums">
                            {kes(r.amount)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500 capitalize">
                            {r.payment_method ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                            {r.reference_number ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatDate(r.paid_at)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={r.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── STRUCTURES TAB ────────────────────────────────────────────────── */}
        {activeTab === "structures" && (
          <>
            {/* Add structure form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-sm font-black text-slate-800 mb-4">
                Set Fee Amount per Grade & Term
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Grade
                  </label>
                  <select
                    aria-label="Select grade"
                    value={structGrade}
                    onChange={(e) => setStructGrade(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select…</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Term
                  </label>
                  <select
                    aria-label="Select term"
                    value={structTerm}
                    onChange={(e) => setStructTerm(parseInt(e.target.value))}
                    className={inputCls}
                  >
                    <option value={1}>Term 1</option>
                    <option value={2}>Term 2</option>
                    <option value={3}>Term 3</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 block">
                    Amount (KES)
                  </label>
                  <input
                    type="number"
                    value={structAmount}
                    onChange={(e) => setStructAmount(e.target.value)}
                    placeholder="e.g. 12000"
                    min="0"
                    className={inputCls}
                  />
                </div>
                <button
                  onClick={handleSaveStructure}
                  disabled={isPending || !structGrade || !structAmount}
                  className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-40"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Save
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                value={structDesc}
                onChange={(e) => setStructDesc(e.target.value)}
                placeholder="Description (optional) e.g. includes lunch + activity fee"
                className={`${inputCls} mt-3 w-full`}
              />
              <p className="text-[10px] text-slate-400 mt-2">
                Saving an existing grade/term/year combination will update the
                amount.
              </p>
            </div>

            {/* Structures table */}
            {structures.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center shadow-sm">
                <p className="text-3xl mb-2">🏛️</p>
                <p className="text-slate-500 font-semibold">
                  No fee structures yet
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  Add one above to start tracking fees
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {[
                        "Grade",
                        "Term",
                        "Year",
                        "Amount",
                        "Description",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-slate-50 hover:bg-slate-50/50"
                      >
                        <td className="px-4 py-3 text-sm font-bold text-slate-700">
                          {s.grade}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          Term {s.term}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {s.academic_year}
                        </td>
                        <td className="px-4 py-3 text-sm font-black text-emerald-700 tabular-nums">
                          {kes(s.amount)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {s.description ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            aria-label="Delete structure"
                            onClick={() => handleDeleteStructure(s.id)}
                            className="text-slate-300 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
