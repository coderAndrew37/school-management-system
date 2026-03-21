"use client";

// app/_components/teachers/TeachersTable.tsx

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Loader2,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import type { Teacher, TeacherStatus } from "@/lib/types/dashboard";
import {
  updateTeacherAction,
  changeTeacherStatusAction,
  deleteTeacherAction,
  resendTeacherInviteAction,
  fetchTeacherAllocationsAction,
  type TeacherAllocationSummary,
} from "@/lib/actions/teachers";
import { getActiveTermYear } from "@/lib/utils/settings"; // used server-side, pass year as prop

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-400",
  "from-rose-400 to-pink-500",
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}

const STATUS_STYLE: Record<TeacherStatus, string> = {
  active: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  on_leave: "bg-amber-400/10   text-amber-400   border-amber-400/20",
  resigned: "bg-slate-400/10   text-slate-400   border-slate-400/20",
  terminated: "bg-rose-400/10    text-rose-400    border-rose-400/20",
};

const STATUS_LABEL: Record<TeacherStatus, string> = {
  active: "Active",
  on_leave: "On Leave",
  resigned: "Resigned",
  terminated: "Terminated",
};

type SortKey = "full_name" | "tsc_number" | "email" | "status" | "created_at";
type SortDir = "asc" | "desc";

// ── Edit drawer ───────────────────────────────────────────────────────────────

function EditDrawer({
  teacher,
  academicYear,
  onClose,
}: {
  teacher: Teacher;
  academicYear: number;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"details" | "allocations" | "status">(
    "details",
  );
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Details state
  const [fullName, setFullName] = useState(teacher.full_name);
  const [phone, setPhone] = useState(teacher.phone_number ?? "");
  const [tscNumber, setTscNumber] = useState(teacher.tsc_number ?? "");

  // Allocations
  const [allocations, setAllocations] = useState<
    TeacherAllocationSummary[] | null
  >(null);

  useEffect(() => {
    if (tab === "allocations" && allocations === null) {
      fetchTeacherAllocationsAction(teacher.id, academicYear).then(
        setAllocations,
      );
    }
  }, [tab, allocations, teacher.id, academicYear]);

  function handleSave() {
    if (!fullName.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("teacherId", teacher.id);
      fd.set("fullName", fullName.trim());
      fd.set("phoneNumber", phone.trim());
      fd.set("tscNumber", tscNumber.trim());
      const result = await updateTeacherAction(fd);
      if (result.success) {
        toast.success(result.message);
        onClose();
      } else toast.error(result.message);
    });
  }

  function handleStatusChange(status: TeacherStatus) {
    startTransition(async () => {
      const result = await changeTeacherStatusAction(teacher.id, status);
      if (result.success) {
        toast.success(result.message);
        onClose();
      } else toast.error(result.message);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteTeacherAction(teacher.id, academicYear);
      if (result.success) {
        toast.success(result.message);
        onClose();
      } else toast.error(result.message);
    });
  }

  function handleResendInvite() {
    startTransition(async () => {
      const result = await resendTeacherInviteAction(teacher.id);
      toast[result.success ? "success" : "error"](result.message);
    });
  }

  const inp =
    "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors";

  const TABS = [
    { id: "details", label: "Details" },
    { id: "allocations", label: "Allocations" },
    { id: "status", label: "Status" },
  ] as const;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#0f1220] border-l border-white/[0.08] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f1220] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`h-12 w-12 rounded-xl bg-gradient-to-br ${avatarColor(teacher.full_name)} flex items-center justify-center text-sm font-bold text-white`}
            >
              {getInitials(teacher.full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {teacher.full_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {teacher.tsc_number && (
                  <p className="text-[10px] text-white/35 font-mono">
                    {teacher.tsc_number}
                  </p>
                )}
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_STYLE[teacher.status]}`}
                >
                  {STATUS_LABEL[teacher.status]}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-white/[0.06] px-2 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "flex-1 py-3 text-xs font-semibold transition-colors",
                tab === t.id
                  ? "text-amber-400 border-b-2 border-amber-400"
                  : "text-white/35 hover:text-white/60",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Details ── */}
          {tab === "details" && (
            <div className="p-6 space-y-5">
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                    Full Name *
                  </label>
                  <input
                    aria-label="teacher full name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inp}
                  />
                </div>

                {/* Email — read-only, it's the auth identifier */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                    Email{" "}
                    <span className="text-white/20 normal-case font-normal">
                      (cannot change)
                    </span>
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                    <Mail className="h-3.5 w-3.5 text-white/20 shrink-0" />
                    <span className="text-sm text-white/40 font-mono truncate">
                      {teacher.email}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0712 345 678"
                      className={inp}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                      TSC Number
                    </label>
                    <input
                      type="text"
                      value={tscNumber}
                      onChange={(e) => setTscNumber(e.target.value)}
                      placeholder="7654321"
                      className={inp}
                    />
                  </div>
                </div>
              </div>

              {/* Read-only info */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                {[
                  ["Joined", fmt(teacher.created_at)],
                  [
                    "Last invite",
                    teacher.last_invite_sent
                      ? fmt(teacher.last_invite_sent)
                      : "Never sent",
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 px-4 py-2.5"
                  >
                    <span className="text-[10px] text-white/30 w-24 shrink-0">
                      {label}
                    </span>
                    <span className="text-xs text-white/55">{value}</span>
                  </div>
                ))}
              </div>

              {/* Resend invite */}
              <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.04] p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-sky-400/80">
                    Account Setup
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5 leading-relaxed">
                    Resend the setup email if the teacher hasn't activated their
                    account.
                  </p>
                </div>
                <button
                  onClick={handleResendInvite}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-400/[0.08] px-3 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-400/15 transition-all disabled:opacity-50 shrink-0"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
                  />
                  Resend
                </button>
              </div>

              {/* Danger zone */}
              <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.03] p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/60">
                  Danger Zone
                </p>
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="flex items-center gap-2 rounded-lg border border-rose-400/20 px-3.5 py-2 text-xs font-semibold text-rose-400/70 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove from System
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-rose-400/80">
                      Permanently removes <strong>{teacher.full_name}</strong>.
                      Blocked if they have active subject allocations for{" "}
                      {academicYear}.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDeleteConfirm(false)}
                        className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-white/50 hover:bg-white/[0.05] transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/20 border border-rose-500/30 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition-all disabled:opacity-50"
                      >
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Confirm Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Allocations ── */}
          {tab === "allocations" && (
            <div className="p-6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Subject Allocations — {academicYear}
              </p>
              {allocations === null ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 text-white/25 animate-spin" />
                </div>
              ) : allocations.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center rounded-xl border border-dashed border-white/10">
                  <BookOpen className="h-8 w-8 text-white/15 mb-3" />
                  <p className="text-white/30 text-sm">No subjects allocated</p>
                  <p className="text-white/20 text-xs mt-1">
                    Assign subjects on the Allocation page.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allocations.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                    >
                      <span className="text-[10px] font-bold font-mono px-2 py-1 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-400">
                        {a.subjectCode}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/75 truncate">
                          {a.subjectName}
                        </p>
                        <p className="text-[11px] text-white/35">{a.grade}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] text-white/25 leading-relaxed">
                  To add or remove allocations, go to the{" "}
                  <a
                    href="/admin/allocation"
                    className="text-amber-400/70 hover:text-amber-400 underline underline-offset-2"
                  >
                    Subject Allocation
                  </a>{" "}
                  page.
                </p>
              </div>
            </div>
          )}

          {/* ── Status ── */}
          {tab === "status" && (
            <div className="p-6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Employment Status
              </p>
              <p className="text-xs text-white/40 leading-relaxed">
                Update the teacher's employment status. Inactive teachers are
                hidden from allocation and class lists but their historical
                records are preserved.
              </p>

              <div className="space-y-2">
                {(
                  [
                    {
                      value: "active",
                      label: "Active",
                      desc: "Currently teaching",
                      color: "emerald",
                    },
                    {
                      value: "on_leave",
                      label: "On Leave",
                      desc: "Temporarily absent",
                      color: "amber",
                    },
                    {
                      value: "resigned",
                      label: "Resigned",
                      desc: "Left the school voluntarily",
                      color: "slate",
                    },
                    {
                      value: "terminated",
                      label: "Terminated",
                      desc: "Employment ended by the school",
                      color: "rose",
                    },
                  ] as const
                ).map(({ value, label, desc, color }) => (
                  <button
                    key={value}
                    onClick={() => handleStatusChange(value)}
                    disabled={isPending || teacher.status === value}
                    className={[
                      "w-full flex items-center justify-between rounded-xl border p-4 text-left transition-all disabled:opacity-50",
                      teacher.status === value
                        ? `border-${color}-400/30 bg-${color}-400/[0.08]`
                        : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]",
                    ].join(" ")}
                  >
                    <div>
                      <p
                        className={`text-sm font-semibold ${teacher.status === value ? `text-${color}-400` : "text-white/70"}`}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">{desc}</p>
                    </div>
                    {teacher.status === value && (
                      <Check className={`h-4 w-4 text-${color}-400 shrink-0`} />
                    )}
                    {isPending && teacher.status !== value && (
                      <Loader2 className="h-4 w-4 text-white/20 animate-spin shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — save on details tab */}
        {tab === "details" && (
          <div className="sticky bottom-0 bg-[#0f1220] border-t border-white/[0.06] px-6 py-4">
            <button
              onClick={handleSave}
              disabled={isPending || !fullName.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-bold text-[#0c0f1a] hover:bg-amber-300 disabled:opacity-50 transition-all"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── Main table component ──────────────────────────────────────────────────────

interface Props {
  teachers: Teacher[];
  academicYear: number;
}

export function TeachersTableClient({ teachers, academicYear }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherStatus | "all">(
    "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editTeacher, setEditTeacher] = useState<Teacher | null>(null);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const filtered = teachers
    .filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.full_name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          (t.tsc_number ?? "").toLowerCase().includes(q) ||
          (t.phone_number ?? "").includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let av: string | number = (a as any)[sortKey] ?? "";
      let bv: string | number = (b as any)[sortKey] ?? "";
      if (sortKey === "created_at") {
        av = new Date(av as string).getTime();
        bv = new Date(bv as string).getTime();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const statusCounts = teachers.reduce<Record<string, number>>(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    { all: teachers.length },
  );

  const COLS: { key: SortKey | null; label: string }[] = [
    { key: "full_name", label: "Teacher" },
    { key: "tsc_number", label: "TSC No." },
    { key: "email", label: "Email" },
    { key: null, label: "Phone" },
    { key: "status", label: "Status" },
    { key: "created_at", label: "Joined" },
    { key: null, label: "" },
  ];

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1 w-max flex-wrap">
        {(
          [
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "on_leave", label: "On Leave" },
            { id: "resigned", label: "Resigned" },
            { id: "terminated", label: "Terminated" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setStatusFilter(t.id)}
            className={[
              "flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all",
              statusFilter === t.id
                ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                : "text-white/35 hover:text-white",
            ].join(" ")}
          >
            {t.label}
            <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-white/40">
              {statusCounts[t.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by name, email or TSC number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40 transition-all"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            aria-label="clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="text-xs text-white/25 font-mono">
        {filtered.length} {filtered.length === 1 ? "teacher" : "teachers"}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-white/[0.07] bg-white/[0.02] text-center">
          <p className="text-4xl mb-3">👩‍🏫</p>
          <p className="text-white/40 text-sm">
            No teachers match your filters
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                {COLS.map(({ key, label }) => (
                  <th
                    key={label + (key ?? "")}
                    onClick={key ? () => handleSort(key) : undefined}
                    className={[
                      "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/30 whitespace-nowrap",
                      key
                        ? "cursor-pointer hover:text-white/60 select-none transition-colors"
                        : "",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-1.5">
                      {label}
                      {key &&
                        (sortKey === key ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="h-3 w-3 text-amber-400" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-amber-400" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 text-white/20" />
                        ))}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((teacher, idx) => (
                <tr
                  key={teacher.id}
                  className={`border-b border-white/[0.04] last:border-0 transition-colors hover:bg-amber-400/[0.03] ${idx % 2 === 0 ? "bg-white/[0.01]" : ""} ${teacher.status !== "active" ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br ${avatarColor(teacher.full_name)} flex items-center justify-center text-xs font-bold text-white`}
                      >
                        {getInitials(teacher.full_name)}
                      </div>
                      <span className="font-medium text-white">
                        {teacher.full_name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {teacher.tsc_number ? (
                      <span className="font-mono text-xs text-emerald-400/80">
                        {teacher.tsc_number}
                      </span>
                    ) : (
                      <span className="text-white/25 text-xs italic">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a
                      href={`mailto:${teacher.email}`}
                      className="text-white/55 text-xs hover:text-amber-400 transition-colors truncate max-w-[200px] block"
                    >
                      {teacher.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {teacher.phone_number ? (
                      <a
                        href={`tel:${teacher.phone_number}`}
                        className="font-mono text-xs text-white/50 hover:text-white/80 transition-colors"
                      >
                        {teacher.phone_number}
                      </a>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${STATUS_STYLE[teacher.status]}`}
                    >
                      {STATUS_LABEL[teacher.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/30 text-xs">
                    {fmt(teacher.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => setEditTeacher(teacher)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTeacher && (
        <EditDrawer
          teacher={editTeacher}
          academicYear={academicYear}
          onClose={() => setEditTeacher(null)}
        />
      )}
    </div>
  );
}
