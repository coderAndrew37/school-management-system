"use client";

import {
  changeTeacherStatusAction,
  deleteTeacherAction,
  fetchTeacherAllocationsAction,
  resendTeacherInviteAction,
  updateTeacherAction,
  type TeacherAllocationSummary,
} from "@/lib/actions/teachers";
import type { Teacher, TeacherStatus } from "@/lib/types/dashboard";
import { Check, Loader2, Mail, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { TeacherAvatar } from "./TeacherAvatar";
import { STATUS_LABEL, STATUS_STYLE } from "./constants";

// Helper for date formatting
const fmt = (dt: string) =>
  new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

interface EditDrawerProps {
  teacher: Teacher;
  academicYear: number;
  onClose: () => void;
}

export function TeacherEditDrawer({
  teacher,
  academicYear,
  onClose,
}: EditDrawerProps) {
  const [tab, setTab] = useState<"details" | "allocations" | "status">(
    "details",
  );
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Form State
  const [fullName, setFullName] = useState(teacher.full_name);
  const [phone, setPhone] = useState(teacher.phone_number ?? "");
  const [tscNumber, setTscNumber] = useState(teacher.tsc_number ?? "");
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

  const handleSave = () => {
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
  };

  const handleStatusChange = (status: TeacherStatus) => {
    startTransition(async () => {
      const result = await changeTeacherStatusAction(teacher.id, status);
      if (result.success) {
        toast.success(result.message);
        onClose();
      } else toast.error(result.message);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTeacherAction(teacher.id, academicYear);
      if (result.success) {
        toast.success(result.message);
        onClose();
      } else toast.error(result.message);
    });
  };

  const handleResendInvite = () => {
    startTransition(async () => {
      const result = await resendTeacherInviteAction(teacher.id);
      toast[result.success ? "success" : "error"](result.message);
    });
  };

  const inp =
    "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-[#0f1220] border-l border-white/[0.08] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f1220] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TeacherAvatar teacher={teacher} className="h-12 w-12 rounded-xl" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {teacher.full_name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${STATUS_STYLE[teacher.status]}`}
                >
                  {STATUS_LABEL[teacher.status]}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            disabled={isPending}
            aria-label="close editing drawer"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] px-2 shrink-0">
          {(["details", "allocations", "status"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-semibold capitalize ${tab === t ? "text-amber-400 border-b-2 border-amber-400" : "text-white/35 hover:text-white/60"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "details" && (
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                  Full Name *
                </label>
                <input
                  placeholder="Full Name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                  Email (Read Only)
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                  <Mail className="h-3.5 w-3.5 text-white/20" />
                  <span className="text-sm text-white/40 font-mono truncate">
                    {teacher.email}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className={inp}
                />
                <input
                  type="text"
                  value={tscNumber}
                  onChange={(e) => setTscNumber(e.target.value)}
                  placeholder="TSC No."
                  className={inp}
                />
              </div>

              {/* Account Actions */}
              <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.04] p-4 flex items-center justify-between">
                <div className="max-w-[200px]">
                  <p className="text-xs font-semibold text-sky-400/80">
                    Account Setup
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Resend setup email if not activated.
                  </p>
                </div>
                <button
                  onClick={handleResendInvite}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-400/[0.08] px-3 py-2 text-xs font-semibold text-sky-400"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
                  />{" "}
                  Resend
                </button>
              </div>

              {/* Danger Zone */}
              <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.03] p-4">
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="text-xs font-semibold text-rose-400/70 hover:text-rose-400 flex items-center gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove Teacher
                  </button>
                ) : (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="flex-1 py-2 text-xs text-white/50 border border-white/10 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex-1 py-2 text-xs font-bold text-rose-400 bg-rose-500/20 border border-rose-500/30 rounded-lg"
                    >
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "allocations" && (
            <div className="space-y-4">
              {/* Allocation logic mapping as seen in original code */}
              {allocations === null ? (
                <Loader2 className="animate-spin mx-auto text-white/20" />
              ) : (
                allocations.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"
                  >
                    <span className="text-[10px] font-bold font-mono px-2 py-1 rounded bg-emerald-400/10 text-emerald-400">
                      {a.subjectCode}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm text-white/75">{a.subjectName}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "status" && (
            <div className="space-y-2">
              {(["active", "on_leave", "resigned", "terminated"] as const).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    disabled={isPending || teacher.status === s}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${teacher.status === s ? "border-amber-400/30 bg-amber-400/10" : "border-white/[0.07] bg-white/[0.02]"}`}
                  >
                    <p className="text-sm font-semibold capitalize text-white">
                      {s.replace("_", " ")}
                    </p>
                  </button>
                ),
              )}
            </div>
          )}
        </div>

        {tab === "details" && (
          <div className="p-4 border-t border-white/[0.06]">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="w-full bg-amber-400 py-3 rounded-xl text-[#0c0f1a] font-bold text-sm flex justify-center gap-2"
            >
              {isPending ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <Check className="h-4 w-4" />
              )}{" "}
              Save Changes
            </button>
          </div>
        )}
      </div>
    </>
  );
}
