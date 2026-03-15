"use client";

// app/admin/students/_components/StudentsTableClient.tsx
// Student register with search/filter/sort + full management drawer.
// Actions: edit details, change grade, replace photo, delete.

import { Student } from "@/lib/types/dashboard";
import {
  getStudentPhotoUrl,
  getStudentInitials,
} from "@/lib/utils/student-photo";
import {
  updateStudentAction,
  deleteStudentAction,
  uploadStudentPhotoAction,
} from "@/lib/actions/students";
// uploadStudentPhotoAction is re-exported from lib/actions/students for convenience
import {
  AlertCircle,
  Camera,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  Filter,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { ALL_GRADES } from "@/lib/types/allocation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const avatarGradients = [
  "from-amber-400 to-orange-500",
  "from-sky-400 to-blue-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-blue-400",
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarGradients[Math.abs(hash) % avatarGradients.length]!;
}

type SortKey =
  | "full_name"
  | "readable_id"
  | "current_grade"
  | "date_of_birth"
  | "gender"
  | "created_at";
type SortDir = "asc" | "desc";

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
        "fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl cursor-pointer transition-all",
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

// ── Student avatar / photo ────────────────────────────────────────────────────

function StudentAvatar({
  student,
  size = "sm",
}: {
  student: Student;
  size?: "sm" | "lg";
}) {
  const photoUrl = getStudentPhotoUrl(student.photo_url);
  const initials = getStudentInitials(student.full_name);
  const gradient = getAvatarGradient(student.full_name);
  const dim =
    size === "lg"
      ? "h-16 w-16 rounded-2xl text-lg"
      : "h-8 w-8 rounded-lg text-xs";

  if (photoUrl) {
    return (
      <div className={`relative flex-shrink-0 overflow-hidden ${dim}`}>
        <Image
          src={photoUrl}
          alt={student.full_name}
          fill
          unoptimized
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex-shrink-0 bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white ${dim}`}
    >
      {initials}
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
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Form state
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const result = await uploadStudentPhotoAction(student.id, fd);
    setPhotoUploading(false);
    if (result.success) {
      setPhotoFile(null);
      onToast("success", "Photo updated.");
    } else {
      onToast("error", result.message);
    }
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

      const result = await updateStudentAction(fd);

      // Upload photo alongside if changed
      if (result.success && photoFile) {
        const fd2 = new FormData();
        fd2.set("photo", photoFile);
        const photoResult = await uploadStudentPhotoAction(student.id, fd2);
        if (!photoResult.success) {
          onToast(
            "error",
            `Details saved but photo failed: ${photoResult.message}`,
          );
          onClose();
          return;
        }
      }

      onToast(result.success ? "success" : "error", result.message);
      if (result.success) onClose();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("studentId", student.id);
      const result = await deleteStudentAction(fd);
      onToast(result.success ? "success" : "error", result.message);
      if (result.success) onClose();
    });
  }

  const inp =
    "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/50 transition-colors";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#0f1220] border-l border-white/[0.08] flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f1220] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <StudentAvatar student={student} size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {student.full_name}
              </p>
              <p className="text-xs text-white/35 font-mono">
                {student.readable_id ?? "No ID"}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* ── Photo ──────────────────────────────────────────────────── */}
          <section>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
              Passport Photo
            </p>
            <div className="flex items-start gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-24 rounded-xl border-2 border-dashed border-white/15 bg-white/[0.04] flex items-center justify-center flex-shrink-0 cursor-pointer hover:border-amber-400/40 hover:bg-white/[0.07] transition-all overflow-hidden group"
              >
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
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

              <div className="flex-1 space-y-2">
                <input
                  aria-label="user photo"
                  id="photo"
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
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
          </section>

          {/* ── Student details ─────────────────────────────────────────── */}
          <section className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
              Student Details
            </p>

            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inp}
                placeholder="Student full name"
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
          </section>

          {/* ── Read-only info ──────────────────────────────────────────── */}
          <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04]">
            {[
              [
                "Date of Birth",
                `${formatDate(student.date_of_birth)} (${calcAge(student.date_of_birth)} yrs)`,
              ],
              ["Student ID", student.readable_id ?? "Auto-assigned"],
              ["Admitted", formatDate(student.created_at)],
              ["Parent", student.parents?.full_name ?? "—"],
              ["Parent Phone", student.parents?.phone_number ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center gap-4 px-4 py-2.5">
                <span className="text-[10px] text-white/30 w-24 shrink-0">
                  {label}
                </span>
                <span className="text-xs text-white/60 truncate">{value}</span>
              </div>
            ))}
          </section>

          {/* ── Danger zone ─────────────────────────────────────────────── */}
          <section className="rounded-xl border border-rose-400/15 bg-rose-400/[0.03] p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400/60">
              Danger Zone
            </p>
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 rounded-lg border border-rose-400/20 px-3.5 py-2 text-xs font-semibold text-rose-400/70 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Student Record
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-rose-400/80">
                  This will permanently delete{" "}
                  <strong>{student.full_name}</strong> and all linked
                  assessments, attendance and diary entries. This cannot be
                  undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 rounded-lg border border-white/10 py-2 text-xs font-semibold text-white/50 hover:bg-white/[0.05] transition-all"
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
          </section>
        </div>

        {/* Footer — Save button */}
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
      </div>
    </>
  );
}

// ── Main client component ──────────────────────────────────────────────────────

interface Props {
  students: Student[];
  uniqueGrades: string[];
}

export function StudentsTableClient({ students, uniqueGrades }: Props) {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
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
  }, [students, search, gradeFilter, genderFilter, sortKey, sortDir]);

  const COLUMNS: { key: SortKey | null; label: string }[] = [
    { key: "full_name", label: "Student" },
    { key: "readable_id", label: "ID" },
    { key: "current_grade", label: "Grade" },
    { key: "gender", label: "Gender" },
    { key: "date_of_birth", label: "Age / DOB" },
    { key: null, label: "Parent" },
    { key: "created_at", label: "Admitted" },
    { key: null, label: "" }, // actions column
  ];

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, ID or parent…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-amber-400/40 focus:bg-white/[0.06] transition-all"
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
      </div>

      {/* Count */}
      <p className="text-xs text-white/25 font-mono">
        {filtered.length} {filtered.length === 1 ? "student" : "students"} found
        {hasActiveFilters && " · filters active"}
      </p>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <p className="text-5xl mb-4">{hasActiveFilters ? "🔍" : "🎒"}</p>
          <p className="text-white/50 font-medium">
            {hasActiveFilters
              ? "No students match your filters"
              : "No students admitted yet"}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearch("");
                setGradeFilter("");
                setGenderFilter("");
              }}
              className="mt-3 text-xs text-amber-400/60 hover:text-amber-400 underline underline-offset-2 transition-colors"
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
                {COLUMNS.map(({ key, label }) => (
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
                  className={`border-b border-white/[0.04] last:border-0 transition-colors hover:bg-amber-400/[0.03] ${idx % 2 === 0 ? "bg-white/[0.01]" : ""}`}
                >
                  {/* Name + photo */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <StudentAvatar student={student} />
                      <span className="font-medium text-white">
                        {student.full_name}
                      </span>
                    </div>
                  </td>

                  {/* ID */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-amber-400/80">
                      {student.readable_id ?? "—"}
                    </span>
                  </td>

                  {/* Grade */}
                  <td className="px-4 py-3 whitespace-nowrap text-white/70">
                    {student.current_grade}
                  </td>

                  {/* Gender */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {student.gender ? (
                      <span
                        className={[
                          "inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          student.gender === "Male"
                            ? "bg-sky-400/10 text-sky-400 border-sky-400/20"
                            : "bg-rose-400/10 text-rose-400 border-rose-400/20",
                        ].join(" ")}
                      >
                        {student.gender}
                      </span>
                    ) : (
                      <span className="text-white/25">—</span>
                    )}
                  </td>

                  {/* Age / DOB */}
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

                  {/* Parent */}
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

                  {/* Admitted */}
                  <td className="px-4 py-3 whitespace-nowrap text-white/30 text-xs">
                    {formatDate(student.created_at)}
                  </td>

                  {/* Actions */}
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

      {/* Edit drawer */}
      {editStudent && (
        <EditDrawer
          student={editStudent}
          onClose={() => setEditStudent(null)}
          onToast={showToast}
        />
      )}

      {/* Toast */}
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
