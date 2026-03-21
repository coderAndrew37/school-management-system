"use client";

// app/admin/students/_components/StudentsTableClient.tsx

import type {
  Student,
  StudentParentLink,
  StudentStatus,
} from "@/lib/types/dashboard";
import {
  getStudentPhotoUrl,
  getStudentInitials,
} from "@/lib/utils/student-photo";
import {
  updateStudentAction,
  deleteStudentAction,
  uploadStudentPhotoAction,
  changeStudentStatusAction,
  linkParentToStudentAction,
  unlinkParentFromStudentAction,
  setPrimaryContactAction,
} from "@/lib/actions/students";
import {
  searchParentsAction,
  resendInviteAction,
  type ParentSearchResult,
} from "@/lib/actions/admit";
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Download,
  Filter,
  Loader2,
  Pencil,
  Printer,
  Search,
  Star,
  Trash2,
  UserMinus,
  UserPlus,
  X,
  RefreshCw,
  Archive,
  GraduationCap,
} from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ALL_GRADES } from "@/lib/types/allocation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  const b = new Date(dob),
    n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

function fmt(dt: string) {
  return new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-blue-400",
];
function gradient(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return GRADIENTS[Math.abs(h) % GRADIENTS.length]!;
}

const STATUS_STYLES: Record<StudentStatus, string> = {
  active: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  transferred: "bg-sky-400/10     text-sky-400     border-sky-400/20",
  graduated: "bg-amber-400/10   text-amber-400   border-amber-400/20",
  withdrawn: "bg-rose-400/10    text-rose-400    border-rose-400/20",
};

type SortKey =
  | "full_name"
  | "readable_id"
  | "current_grade"
  | "date_of_birth"
  | "gender"
  | "created_at";
type SortDir = "asc" | "desc";

// ── CSV/Excel export ──────────────────────────────────────────────────────────

function exportToCSV(students: Student[], gradeLabel?: string) {
  const headers = [
    "ID",
    "Full Name",
    "Grade",
    "Gender",
    "Date of Birth",
    "Age",
    "UPI Number",
    "Status",
    "Parent Name",
    "Parent Phone",
    "Parent Email",
    "Admitted Date",
  ];

  const rows = students.map((s) => [
    s.readable_id ?? "",
    s.full_name,
    s.current_grade,
    s.gender ?? "",
    s.date_of_birth,
    String(calcAge(s.date_of_birth)),
    s.upi_number ?? "",
    s.status,
    s.parents?.full_name ?? "",
    s.parents?.phone_number ?? "",
    s.all_parents.find((p) => p.is_primary_contact)?.email ?? "",
    fmt(s.created_at),
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const slug = gradeLabel
    ? gradeLabel.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-")
    : "all";
  a.download = `kibali-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Print class list ──────────────────────────────────────────────────────────

function printClassList(students: Student[], grade: string) {
  const rows = students
    .filter((s) => s.current_grade === grade)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  const male = rows.filter((s) => s.gender === "Male").length;
  const female = rows.filter((s) => s.gender === "Female").length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${grade} — Class Register</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    h1 { font-size: 18px; font-weight: 800; margin-bottom: 2px; }
    .meta { font-size: 11px; color: #666; margin-bottom: 16px; }
    .stats { display: flex; gap: 24px; margin-bottom: 16px; padding: 10px 14px;
             background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; }
    .stat-label { font-size: 10px; text-transform: uppercase; color: #9ca3af; display: block; }
    .stat-value { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f3f4f6; padding: 7px 10px; text-align: left;
         font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em;
         color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    .no { font-weight: 700; color: #9ca3af; width: 32px; }
    .id { font-family: monospace; color: #d97706; font-size: 10px; }
    .male   { color: #0284c7; font-weight: 600; }
    .female { color: #db2777; font-weight: 600; }
    .parent { color: #6b7280; font-size: 10px; }
    .sig-row { margin-top: 40px; display: flex; gap: 60px; }
    .sig-line { border-top: 1px solid #000; width: 200px; padding-top: 4px;
                font-size: 10px; color: #6b7280; }
    @media print { @page { margin: 1.5cm; } }
  </style>
</head>
<body>
  <h1>Kibali Academy — ${grade}</h1>
  <p class="meta">Class Register · Printed ${new Date().toLocaleDateString(
    "en-KE",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    },
  )}</p>

  <div class="stats">
    <div><span class="stat-label">Total</span><span class="stat-value">${rows.length}</span></div>
    <div><span class="stat-label">Male</span><span class="stat-value" style="color:#0284c7">${male}</span></div>
    <div><span class="stat-label">Female</span><span class="stat-value" style="color:#db2777">${female}</span></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Student ID</th>
        <th>Full Name</th>
        <th>Gender</th>
        <th>Date of Birth</th>
        <th>UPI Number</th>
        <th>Parent / Guardian</th>
        <th>Phone</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (s, i) => `
        <tr>
          <td class="no">${i + 1}</td>
          <td class="id">${s.readable_id ?? "—"}</td>
          <td><strong>${s.full_name}</strong></td>
          <td class="${s.gender === "Male" ? "male" : s.gender === "Female" ? "female" : ""}">${s.gender ?? "—"}</td>
          <td>${new Date(s.date_of_birth).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</td>
          <td class="id">${s.upi_number ?? "—"}</td>
          <td class="parent">${s.parents?.full_name ?? "—"}</td>
          <td class="parent">${s.parents?.phone_number ?? "—"}</td>
        </tr>`,
        )
        .join("")}
    </tbody>
  </table>

  <div class="sig-row">
    <div class="sig-line">Class Teacher</div>
    <div class="sig-line">Head Teacher</div>
    <div class="sig-line">Date</div>
  </div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      onClick={onDismiss}
      className={[
        "fixed bottom-6 right-6 z-[70] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl cursor-pointer",
        type === "success"
          ? "bg-emerald-400/15 border border-emerald-400/30 text-emerald-400"
          : "bg-rose-400/15 border border-rose-400/30 text-rose-400",
      ].join(" ")}
    >
      {type === "success" ? (
        <Check className="h-4 w-4" />
      ) : (
        <AlertCircle className="h-4 w-4" />
      )}
      {message}
    </div>
  );
}

// ── Student avatar ────────────────────────────────────────────────────────────

function StudentAvatar({
  student,
  size = "sm",
}: {
  student: Student;
  size?: "sm" | "lg";
}) {
  const url = getStudentPhotoUrl(student.photo_url);
  const initials = getStudentInitials(student.full_name);
  const grad = gradient(student.full_name);
  const cls =
    size === "lg"
      ? "h-16 w-16 rounded-2xl text-lg"
      : "h-8 w-8 rounded-lg text-xs";

  if (url)
    return (
      <div className={`relative flex-shrink-0 overflow-hidden ${cls}`}>
        <Image
          src={url}
          alt={student.full_name}
          fill
          unoptimized
          className="object-cover"
        />
      </div>
    );
  return (
    <div
      className={`flex-shrink-0 bg-gradient-to-br ${grad} flex items-center justify-center font-bold text-white ${cls}`}
    >
      {initials}
    </div>
  );
}

// ── Parent search combobox (reused from admission form) ───────────────────────

function ParentSearch({
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

// ── Edit drawer ───────────────────────────────────────────────────────────────

function EditDrawer({
  student,
  onClose,
  onToast,
}: {
  student: Student;
  onClose: () => void;
  onToast: (type: "success" | "error", message: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"details" | "parents" | "status">("details");
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Details state
  const [fullName, setFullName] = useState(student.full_name);
  const [grade, setGrade] = useState(student.current_grade);
  const [gender, setGender] = useState(student.gender ?? "");
  const [upiNumber, setUpiNumber] = useState(student.upi_number ?? "");

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    getStudentPhotoUrl(student.photo_url),
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Parents state
  const [parents, setParents] = useState<StudentParentLink[]>(
    student.all_parents,
  );
  const [showAddParent, setShowAddParent] = useState(false);
  const [addRelType, setAddRelType] = useState<
    "mother" | "father" | "guardian" | "other"
  >("guardian");

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onToast("error", "Photo must be under 2 MB.");
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;
    setPhotoUploading(true);
    const fd = new FormData();
    fd.set("photo", photoFile);
    const res = await uploadStudentPhotoAction(student.id, fd);
    setPhotoUploading(false);
    if (res.success) {
      setPhotoFile(null);
      onToast("success", "Photo updated.");
    } else onToast("error", res.message);
  }

  function handleSave() {
    if (!fullName.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("studentId", student.id);
      fd.set("fullName", fullName.trim());
      fd.set("currentGrade", grade);
      if (gender) fd.set("gender", gender);
      if (upiNumber) fd.set("upiNumber", upiNumber.trim());
      const res = await updateStudentAction(fd);
      if (res.success && photoFile) {
        const fd2 = new FormData();
        fd2.set("photo", photoFile);
        await uploadStudentPhotoAction(student.id, fd2);
      }
      onToast(res.success ? "success" : "error", res.message);
      if (res.success) onClose();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("studentId", student.id);
      const res = await deleteStudentAction(fd);
      onToast(res.success ? "success" : "error", res.message);
      if (res.success) onClose();
    });
  }

  function handleStatusChange(status: StudentStatus) {
    startTransition(async () => {
      const res = await changeStudentStatusAction(student.id, status);
      onToast(res.success ? "success" : "error", res.message);
      if (res.success) onClose();
    });
  }

  function handleAddParent(p: ParentSearchResult) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("studentId", student.id);
      fd.set("parentId", p.id);
      fd.set("relationshipType", addRelType);
      fd.set("isPrimaryContact", parents.length === 0 ? "true" : "false");
      const res = await linkParentToStudentAction(fd);
      if (res.success) {
        setParents((prev) => [
          ...prev,
          {
            parent_id: p.id,
            full_name: p.full_name,
            phone_number: p.phone_number,
            email: p.email,
            relationship_type: addRelType,
            is_primary_contact: parents.length === 0,
            invite_accepted: false,
          },
        ]);
        setShowAddParent(false);
        onToast("success", `${p.full_name} linked as guardian.`);
      } else {
        onToast("error", res.message);
      }
    });
  }

  function handleRemoveParent(parentId: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("studentId", student.id);
      fd.set("parentId", parentId);
      const res = await unlinkParentFromStudentAction(fd);
      if (res.success) {
        setParents((prev) => prev.filter((p) => p.parent_id !== parentId));
        onToast("success", "Guardian removed.");
      } else {
        onToast("error", res.message);
      }
    });
  }

  function handleSetPrimary(parentId: string) {
    startTransition(async () => {
      const res = await setPrimaryContactAction(student.id, parentId);
      if (res.success) {
        setParents((prev) =>
          prev.map((p) => ({
            ...p,
            is_primary_contact: p.parent_id === parentId,
          })),
        );
        onToast("success", "Primary contact updated.");
      } else {
        onToast("error", res.message);
      }
    });
  }

  async function handleResendInvite(parentId: string) {
    startTransition(async () => {
      const res = await resendInviteAction(parentId);
      onToast(res.success ? "success" : "error", res.message);
    });
  }

  const inp =
    "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/50 transition-colors";

  const TABS = [
    { id: "details", label: "Details" },
    { id: "parents", label: `Parents (${parents.length})` },
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
        <div className="sticky top-0 bg-[#0f1220] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <StudentAvatar student={student} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {student.full_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-white/35 font-mono">
                  {student.readable_id ?? "No ID"}
                </p>
                <span
                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_STYLES[student.status]}`}
                >
                  {student.status}
                </span>
              </div>
            </div>
          </div>
          <button
            aria-label="close panel"
            onClick={onClose}
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
          {/* ── TAB: Details ─────────────────────────────────────────────── */}
          {tab === "details" && (
            <div className="p-6 space-y-5">
              {/* Photo */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
                  Passport Photo
                </p>
                <div className="flex items-start gap-4">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="relative w-20 h-24 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.04] flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-amber-400/40 hover:bg-white/[0.07] transition-all overflow-hidden group"
                  >
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="h-6 w-6 text-white/20 group-hover:text-white/40 transition-colors" />
                    )}
                    {photoUploading && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 flex-1">
                    <input
                      aria-label="student photo"
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      {photoPreview ? "Replace Photo" : "Upload Photo"}
                    </button>
                    {photoFile && (
                      <button
                        type="button"
                        onClick={handlePhotoUpload}
                        disabled={photoUploading}
                        className="flex items-center gap-2 rounded-lg bg-amber-400/15 border border-amber-400/30 px-3 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-400/20 transition-all disabled:opacity-50"
                      >
                        {photoUploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Save Photo Now
                      </button>
                    )}
                    <p className="text-[10px] text-white/25">
                      JPEG, PNG or WEBP · Max 2 MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Fields */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
                  Student Details
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      aria-label="student full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={inp}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                        Grade
                      </label>
                      <select
                        aria-label="student grade"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className={`${inp} cursor-pointer`}
                      >
                        {ALL_GRADES.map((g) => (
                          <option key={g} value={g} className="bg-[#0f1220]">
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                        Gender
                      </label>
                      <select
                        aria-label="student gender"
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className={`${inp} cursor-pointer`}
                      >
                        <option value="" className="bg-[#0f1220]">
                          — Select —
                        </option>
                        <option value="Male" className="bg-[#0f1220]">
                          Male
                        </option>
                        <option value="Female" className="bg-[#0f1220]">
                          Female
                        </option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                      UPI Number{" "}
                      <span className="text-white/20 normal-case font-normal">
                        (optional)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={upiNumber}
                      onChange={(e) => setUpiNumber(e.target.value)}
                      className={inp}
                      placeholder="e.g. 1234567890"
                    />
                  </div>
                </div>
              </div>

              {/* Read-only */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
                {[
                  [
                    "Date of Birth",
                    `${fmt(student.date_of_birth)} (${calcAge(student.date_of_birth)} yrs)`,
                  ],
                  ["Student ID", student.readable_id ?? "Auto-assigned"],
                  ["Admitted", fmt(student.created_at)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center gap-4 px-4 py-2.5"
                  >
                    <span className="text-[10px] text-white/30 w-24 shrink-0">
                      {label}
                    </span>
                    <span className="text-xs text-white/60 truncate">
                      {value}
                    </span>
                  </div>
                ))}
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
                    <Trash2 className="h-3.5 w-3.5" /> Permanently Delete Record
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-rose-400/80">
                      Permanently deletes <strong>{student.full_name}</strong>{" "}
                      and all linked data. Consider using "Mark as Transferred"
                      in the Status tab instead.
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
                        className="flex-1 rounded-lg bg-rose-500/20 border border-rose-500/30 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
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

          {/* ── TAB: Parents ─────────────────────────────────────────────── */}
          {tab === "parents" && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                  Linked Guardians
                </p>
                <button
                  onClick={() => setShowAddParent((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.08] px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-400/15 transition-all"
                >
                  {showAddParent ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  {showAddParent ? "Cancel" : "Add Guardian"}
                </button>
              </div>

              {/* Add guardian panel */}
              {showAddParent && (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 space-y-3">
                  <p className="text-xs font-semibold text-white/50">
                    Link an existing parent account
                  </p>
                  <div>
                    <label className="block text-[10px] text-white/30 mb-1.5">
                      Relationship
                    </label>
                    <select
                      aria-label="link an existing parent to a student"
                      value={addRelType}
                      onChange={(e) => setAddRelType(e.target.value as any)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 transition-colors cursor-pointer"
                    >
                      {[
                        ["mother", "Mother"],
                        ["father", "Father"],
                        ["guardian", "Guardian"],
                        ["other", "Other"],
                      ].map(([v, l]) => (
                        <option key={v} value={v} className="bg-[#0f1220]">
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                  <ParentSearch
                    onSelect={handleAddParent}
                    disabled={isPending}
                  />
                </div>
              )}

              {/* Parent cards */}
              {parents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-white/10">
                  <p className="text-white/30 text-sm">
                    No guardians linked yet
                  </p>
                  <p className="text-white/20 text-xs mt-1">
                    Use "Add Guardian" to link a parent account
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {parents.map((p) => (
                    <div
                      key={p.parent_id}
                      className={[
                        "rounded-xl border p-4 space-y-3",
                        p.is_primary_contact
                          ? "border-amber-400/20 bg-amber-400/[0.04]"
                          : "border-white/[0.07] bg-white/[0.02]",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white truncate">
                              {p.full_name}
                            </p>
                            {p.is_primary_contact && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5 shrink-0">
                                <Star className="h-2.5 w-2.5" /> Primary
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/40 capitalize mt-0.5">
                            {p.relationship_type}
                          </p>
                          <p className="text-xs text-white/35">
                            {p.phone_number ?? "—"}
                          </p>
                          <p className="text-xs text-white/25 font-mono truncate">
                            {p.email}
                          </p>
                        </div>
                        <span
                          className={[
                            "text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded border shrink-0",
                            p.invite_accepted
                              ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                              : "bg-rose-400/10 text-rose-400 border-rose-400/20",
                          ].join(" ")}
                        >
                          {p.invite_accepted ? "Active" : "Pending"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {!p.is_primary_contact && (
                          <button
                            onClick={() => handleSetPrimary(p.parent_id)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:text-amber-400 hover:border-amber-400/25 transition-all disabled:opacity-40"
                          >
                            <Star className="h-3 w-3" /> Set Primary
                          </button>
                        )}
                        {!p.invite_accepted && (
                          <button
                            onClick={() => handleResendInvite(p.parent_id)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:text-sky-400 hover:border-sky-400/25 transition-all disabled:opacity-40"
                          >
                            <RefreshCw className="h-3 w-3" /> Resend Invite
                          </button>
                        )}
                        {parents.length > 1 && (
                          <button
                            onClick={() => handleRemoveParent(p.parent_id)}
                            disabled={isPending}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-white/50 hover:text-rose-400 hover:border-rose-400/25 transition-all disabled:opacity-40"
                          >
                            <UserMinus className="h-3 w-3" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Status ──────────────────────────────────────────────── */}
          {tab === "status" && (
            <div className="p-6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Student Status
              </p>
              <p className="text-xs text-white/40 leading-relaxed">
                Change the student's enrolment status. Unlike deletion, this
                preserves all historical assessments, attendance records, and
                report cards. Inactive students are hidden from the main
                register by default.
              </p>

              <div className="space-y-2">
                {(
                  [
                    {
                      value: "active",
                      label: "Active",
                      desc: "Currently enrolled",
                      color: "emerald",
                    },
                    {
                      value: "transferred",
                      label: "Transferred",
                      desc: "Left to join another school",
                      color: "sky",
                    },
                    {
                      value: "graduated",
                      label: "Graduated",
                      desc: "Completed Grade 9 / JSS 3",
                      color: "amber",
                    },
                    {
                      value: "withdrawn",
                      label: "Withdrawn",
                      desc: "Left school, reason not specified",
                      color: "rose",
                    },
                  ] as const
                ).map(({ value, label, desc, color }) => (
                  <button
                    key={value}
                    onClick={() => handleStatusChange(value)}
                    disabled={isPending || student.status === value}
                    className={[
                      "w-full flex items-center justify-between rounded-xl border p-4 text-left transition-all disabled:opacity-40",
                      student.status === value
                        ? `border-${color}-400/30 bg-${color}-400/[0.08]`
                        : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]",
                    ].join(" ")}
                  >
                    <div>
                      <p
                        className={`text-sm font-semibold ${student.status === value ? `text-${color}-400` : "text-white/70"}`}
                      >
                        {label}
                      </p>
                      <p className="text-xs text-white/30 mt-0.5">{desc}</p>
                    </div>
                    {student.status === value && (
                      <Check className={`h-4 w-4 text-${color}-400 shrink-0`} />
                    )}
                    {isPending && student.status !== value && (
                      <Loader2 className="h-4 w-4 text-white/20 animate-spin shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-4 py-3">
                <p className="text-[10px] text-amber-400/70 leading-relaxed">
                  Transferred and withdrawn students remain in the database for
                  historical reporting. Use "Permanently Delete" in the Details
                  tab only when absolutely necessary.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
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

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  students: Student[];
  uniqueGrades: string[];
}

export function StudentsTableClient({ students, uniqueGrades }: Props) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const hasActiveFilters = search || gradeFilter || genderFilter;

  const filtered = useMemo(() => {
    let result = [...students];
    if (statusFilter && statusFilter !== "all")
      result = result.filter((s) => s.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          (s.readable_id ?? "").toLowerCase().includes(q) ||
          (s.parents?.full_name ?? "").toLowerCase().includes(q),
      );
    }
    if (gradeFilter)
      result = result.filter((s) => s.current_grade === gradeFilter);
    if (genderFilter) result = result.filter((s) => s.gender === genderFilter);

    result.sort((a, b) => {
      let av: string | number = (a as any)[sortKey] ?? "";
      let bv: string | number = (b as any)[sortKey] ?? "";
      if (sortKey === "date_of_birth" || sortKey === "created_at") {
        av = new Date(av as string).getTime();
        bv = new Date(bv as string).getTime();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [
    students,
    search,
    gradeFilter,
    genderFilter,
    statusFilter,
    sortKey,
    sortDir,
  ]);

  const COLS: { key: SortKey | null; label: string }[] = [
    { key: "full_name", label: "Student" },
    { key: "readable_id", label: "ID" },
    { key: "current_grade", label: "Grade" },
    { key: "gender", label: "Gender" },
    { key: "date_of_birth", label: "Age / DOB" },
    { key: null, label: "Parent" },
    { key: "created_at", label: "Admitted" },
    { key: null, label: "" },
  ];

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: students.length };
    for (const s of students) c[s.status] = (c[s.status] ?? 0) + 1;
    return c;
  }, [students]);

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1 w-max flex-wrap">
        {[
          { id: "all", label: "All" },
          { id: "active", label: "Active" },
          { id: "transferred", label: "Transferred" },
          { id: "graduated", label: "Graduated" },
          { id: "withdrawn", label: "Withdrawn" },
        ].map((t) => (
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

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, ID or parent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40 transition-all"
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

        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
          <select
            aria-label="grade filter"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 cursor-pointer transition-all"
          >
            <option value="">All Grades</option>
            {uniqueGrades.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            aria-label="gender filter"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 pr-8 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 cursor-pointer transition-all"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setSearch("");
              setGradeFilter("");
              setGenderFilter("");
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/40 hover:text-white/70 hover:border-white/[0.16] transition-all"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}

        {/* Export */}
        <button
          onClick={() => exportToCSV(filtered, gradeFilter || undefined)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white/50 hover:text-white hover:bg-white/[0.06] transition-all whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* Class summary strip — shown when a single grade is filtered */}
      {gradeFilter &&
        (() => {
          const classStudents = filtered;
          const boys = classStudents.filter((s) => s.gender === "Male").length;
          const girls = classStudents.filter(
            (s) => s.gender === "Female",
          ).length;
          return (
            <div className="flex items-center gap-3 flex-wrap rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
              <div className="flex items-center gap-2 text-amber-400">
                <GraduationCap className="h-4 w-4" />
                <span className="text-sm font-bold">{gradeFilter}</span>
              </div>
              <div className="h-4 w-px bg-white/10" />
              <span className="text-xs text-white/50">
                {classStudents.length} students
              </span>
              <span className="text-[10px] text-sky-400 font-semibold bg-sky-400/10 border border-sky-400/15 rounded-md px-2 py-0.5">
                {boys} boys
              </span>
              <span className="text-[10px] text-rose-400 font-semibold bg-rose-400/10 border border-rose-400/15 rounded-md px-2 py-0.5">
                {girls} girls
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => printClassList(students, gradeFilter)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/50 hover:text-white hover:bg-white/[0.07] transition-all"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Register
                </button>
                <button
                  onClick={() => exportToCSV(classStudents, gradeFilter)}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.08] px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-400/15 transition-all"
                >
                  <Download className="h-3.5 w-3.5" /> Export Class CSV
                </button>
              </div>
            </div>
          );
        })()}

      <p className="text-xs text-white/25 font-mono">
        {filtered.length} {filtered.length === 1 ? "student" : "students"} found
        {hasActiveFilters && " · filters active"}
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <p className="text-5xl mb-4">
            {hasActiveFilters || statusFilter !== "active" ? "🔍" : "🎒"}
          </p>
          <p className="text-white/50 font-medium">
            {hasActiveFilters
              ? "No students match your filters"
              : "No students in this category"}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearch("");
                setGradeFilter("");
                setGenderFilter("");
              }}
              className="mt-3 text-xs text-amber-400/60 hover:text-amber-400 underline underline-offset-2"
            >
              Clear filters
            </button>
          )}
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
              {filtered.map((student, idx) => (
                <tr
                  key={student.id}
                  className={`border-b border-white/[0.04] last:border-0 transition-colors hover:bg-amber-400/[0.03] ${idx % 2 === 0 ? "bg-white/[0.01]" : ""} ${student.status !== "active" ? "opacity-60" : ""}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <StudentAvatar student={student} />
                      <div>
                        <p className="font-medium text-white">
                          {student.full_name}
                        </p>
                        {student.status !== "active" && (
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLES[student.status]}`}
                          >
                            {student.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-amber-400/80">
                      {student.readable_id ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/70">
                    {student.current_grade}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {student.gender ? (
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${student.gender === "Male" ? "bg-sky-400/10 text-sky-400 border-sky-400/20" : "bg-rose-400/10 text-rose-400 border-rose-400/20"}`}
                      >
                        {student.gender}
                      </span>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-white/80">
                      {calcAge(student.date_of_birth)} yrs
                    </span>
                    <span className="text-white/30 text-xs ml-1.5">
                      {new Date(student.date_of_birth).toLocaleDateString(
                        "en-KE",
                        { day: "numeric", month: "short", year: "numeric" },
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {student.parents ? (
                      <div>
                        <p className="text-white/60 text-xs truncate max-w-[160px]">
                          {student.parents.full_name !== "To be updated"
                            ? student.parents.full_name
                            : "—"}
                        </p>
                        <p className="text-white/30 text-xs font-mono">
                          {student.parents.phone_number}
                        </p>
                      </div>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/30 text-xs">
                    {fmt(student.created_at)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => setEditStudent(student)}
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

      {editStudent && (
        <EditDrawer
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onToast={showToast}
        />
      )}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
