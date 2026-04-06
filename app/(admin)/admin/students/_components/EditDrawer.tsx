import { useTransition, useState, useRef } from "react";
import {
  X,
  Camera,
  Loader2,
  Check,
  Trash2,
  UserPlus,
  Star,
  RefreshCw,
  UserMinus,
} from "lucide-react";

import { fmt } from "@/app/_components/parents/parent-utils";
import { calcAge } from "@/lib/helpers/parent";
import { getStudentPhotoUrl } from "@/lib/utils/photo-utils";

import {
  uploadStudentPhotoAction,
  ParentSearchResult,
  resendInviteAction,
} from "@/lib/actions/admit";

import {
  updateStudentAction,
  deleteStudentAction,
  changeStudentStatusAction,
  linkParentToStudentAction,
  unlinkParentFromStudentAction,
  setPrimaryContactAction,
} from "@/lib/actions/students";

import {
  Student,
  StudentParentLink,
  StudentStatus,
} from "@/lib/types/dashboard";

import ParentSearch from "./ParentSearch";
import StudentAvatar from "./StudentAvatar";

const STATUS_STYLES: Record<StudentStatus, string> = {
  active: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  transferred: "bg-sky-400/10 text-sky-400 border-sky-400/20",
  graduated: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  withdrawn: "bg-rose-400/10 text-rose-400 border-rose-400/20",
};

export default function EditDrawer({
  student,
  allGrades,
  onClose,
  onToast,
}: {
  student: Student;
  onClose: () => void;
  onToast: (type: "success" | "error", message: string) => void;
  allGrades: string[];
  allStreams: string[];
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

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
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
    } else {
      onToast("error", res.message);
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
          {/* TAB: Details */}
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
                        {allGrades.map((g) => (
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

              {/* Read-only Info */}
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

          {/* TAB: Parents */}
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
                      aria-label="relationship type"
                      value={addRelType}
                      onChange={(e) => setAddRelType(e.target.value as any)}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 transition-colors cursor-pointer"
                    >
                      <option value="mother" className="bg-[#0f1220]">
                        Mother
                      </option>
                      <option value="father" className="bg-[#0f1220]">
                        Father
                      </option>
                      <option value="guardian" className="bg-[#0f1220]">
                        Guardian
                      </option>
                      <option value="other" className="bg-[#0f1220]">
                        Other
                      </option>
                    </select>
                  </div>
                  <ParentSearch
                    onSelect={handleAddParent}
                    disabled={isPending}
                  />
                </div>
              )}

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

          {/* TAB: Status */}
          {tab === "status" && (
            <div className="p-6 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Student Status
              </p>
              <p className="text-xs text-white/40 leading-relaxed">
                Change the student's enrolment status. This preserves all
                historical records.
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
                      desc: "Left for another school",
                      color: "sky",
                    },
                    {
                      value: "graduated",
                      label: "Graduated",
                      desc: "Completed Grade 9",
                      color: "amber",
                    },
                    {
                      value: "withdrawn",
                      label: "Withdrawn",
                      desc: "Left school reason unspecified",
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
                      <Check className={`h-4 w-4 text-${color}-400`} />
                    )}
                    {isPending && student.status !== value && (
                      <Loader2 className="h-4 w-4 text-white/20 animate-spin" />
                    )}
                  </button>
                ))}
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
