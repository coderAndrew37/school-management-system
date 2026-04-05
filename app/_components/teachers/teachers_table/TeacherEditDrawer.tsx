"use client";
// app/_components/teachers/teachers_table/TeacherEditDrawer.tsx
// Lightweight quick-edit drawer — name, phone, TSC, status + avatar.
// Full governance lives at /admin/teachers/[staff_id]

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Teacher } from "@/lib/types/dashboard";
import {
  Camera,
  Check,
  ExternalLink,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { TeacherAvatar } from "./TeacherAvatar";
import { STATUS_LABEL, STATUS_STYLE } from "./constants";
import {
  updateTeacherAction,
  changeTeacherStatusAction,
  deleteTeacherAction,
  resendTeacherInviteAction,
} from "@/lib/actions/teachers";

interface Props {
  teacher: Teacher;
  academicYear: number;
  onClose: () => void;
}

const inp =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors";

export function TeacherEditDrawer({ teacher, academicYear, onClose }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(teacher.full_name);
  const [phone, setPhone] = useState(teacher.phone_number ?? "");
  const [tscNumber, setTscNumber] = useState(teacher.tsc_number ?? "");
  const [avatarUrl, setAvatarUrl] = useState(teacher.avatar_url ?? "");
  const [status, setStatus] = useState(teacher.status);

  // staff_id used for the "View Full Profile" link
  const staffId =
    (teacher as Teacher & { staff_id?: string }).staff_id ?? teacher.id;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Max 2 MB");
      return;
    }
    setIsUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const path = `teachers/${teacher.id}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Photo uploaded — save to apply.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSave() {
    if (!fullName.trim()) return;
    start(async () => {
      const fd = new FormData();
      fd.set("teacherId", teacher.id);
      fd.set("fullName", fullName.trim());
      fd.set("phoneNumber", phone.trim());
      fd.set("tscNumber", tscNumber.trim());
      fd.set("avatarUrl", avatarUrl);
      const res = await updateTeacherAction(fd);
      if (res.success) {
        // Status change if different
        if (status !== teacher.status)
          await changeTeacherStatusAction(teacher.id, status);
        toast.success(res.message);
        router.refresh();
        onClose();
      } else toast.error(res.message);
    });
  }

  function handleDelete() {
    start(async () => {
      const res = await deleteTeacherAction(teacher.id, academicYear);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
        onClose();
      } else toast.error(res.message);
    });
  }

  function handleResend() {
    start(async () => {
      const res = await resendTeacherInviteAction(teacher.id);
      toast[res.success ? "success" : "error"](res.message);
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-[#0f1220] border-l border-white/[0.08] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-[#0f1220] border-b border-white/[0.06] px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="relative group cursor-pointer shrink-0"
              onClick={() => fileRef.current?.click()}
            >
              <TeacherAvatar
                teacher={{ ...teacher, avatar_url: avatarUrl }}
                className="h-11 w-11 rounded-xl transition-all duration-200 group-hover:opacity-60"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading ? (
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                ) : (
                  <Camera className="h-4 w-4 text-white" />
                )}
              </div>
              <input
                aria-label="teacher avatar"
                type="file"
                ref={fileRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">
                {fullName || teacher.full_name}
              </p>
              <span
                className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${STATUS_STYLE[teacher.status]}`}
              >
                {STATUS_LABEL[teacher.status]}
              </span>
            </div>
          </div>
          <button
            aria-label="close"
            onClick={onClose}
            disabled={isPending}
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.06]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* View full profile link */}
        <Link
          href={`/admin/teachers/${staffId}`}
          onClick={onClose}
          className="flex items-center justify-between px-5 py-2.5 bg-amber-400/[0.06] border-b border-amber-400/10 hover:bg-amber-400/10 transition-colors group"
        >
          <span className="text-xs font-semibold text-amber-400/80 group-hover:text-amber-400">
            View Full Profile
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-amber-400/50 group-hover:text-amber-400" />
        </Link>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
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
              placeholder="e.g. 1234567"
              className={inp}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
              Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07XXXXXXXX"
              className={inp}
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
              Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["active", "on_leave", "resigned", "terminated"] as const).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    type="button"
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${status === s ? "border-amber-400/40 bg-amber-400/10 text-amber-400" : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:border-white/20"}`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ),
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
              Email (read-only)
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
              <Mail className="h-3.5 w-3.5 text-white/20 shrink-0" />
              <span className="text-sm text-white/40 font-mono truncate">
                {teacher.email}
              </span>
            </div>
          </div>

          {/* Resend invite */}
          <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.04] px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sky-400/80">
                Portal Access
              </p>
              <p className="text-[10px] text-white/30 mt-0.5">
                Resend setup email if not activated.
              </p>
            </div>
            <button
              onClick={handleResend}
              disabled={isPending}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-400/[0.08] px-3 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-400/20 transition-colors"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
              />{" "}
              Resend
            </button>
          </div>

          {/* Delete */}
          <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.03] p-4">
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="text-xs font-semibold text-rose-400/70 hover:text-rose-400 flex items-center gap-2 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove Teacher
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-rose-400/80">
                  This removes the teacher and all allocations. Continue?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 py-2 text-xs text-white/50 border border-white/10 rounded-lg hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="flex-1 py-2 text-xs font-bold text-rose-400 bg-rose-500/20 border border-rose-500/30 rounded-lg hover:bg-rose-500/30"
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
                    ) : (
                      "Confirm"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer save */}
        <div className="p-4 border-t border-white/[0.06] bg-[#0f1220]">
          <button
            onClick={handleSave}
            disabled={isPending || isUploading}
            className="w-full bg-amber-400 hover:bg-amber-300 py-3 rounded-xl text-[#0c0f1a] font-bold text-sm flex justify-center items-center gap-2 transition-all shadow-lg shadow-amber-400/10 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}
