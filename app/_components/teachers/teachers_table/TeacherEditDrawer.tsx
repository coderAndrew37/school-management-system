"use client";

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
  ChevronRight,
  AlertCircle
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
  archiveTeacherAction,
  resendTeacherInviteAction,
} from "@/lib/actions/teachers";

interface Props {
  teacher: Teacher;
  academicYear: number;
  onClose: () => void;
}

const inp =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors";

// These reasons match the CHECK constraint in your Postgres table exactly
const ARCHIVE_REASONS = [
  { id: "transferred", label: "Transfer to Another School" },
  { id: "resigned", label: "Voluntary Resignation" },
  { id: "retired", label: "Retirement" },
  { id: "terminated", label: "Termination / Sacking" },
  { id: "deceased", label: "Deceased" },
] as const;

type ArchiveStatus = typeof ARCHIVE_REASONS[number]["id"];

export function TeacherEditDrawer({ teacher, academicYear, onClose }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  
  // Archive UI States
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ArchiveStatus | null>(null);
  
  const fileRef = useRef<HTMLInputElement>(null);

  // Form States
  const [fullName, setFullName] = useState(teacher.full_name);
  const [phone, setPhone] = useState(teacher.phone_number ?? "");
  const [tscNumber, setTscNumber] = useState(teacher.tsc_number ?? "");
  const [avatarUrl, setAvatarUrl] = useState(teacher.avatar_url ?? "");
  const [status, setStatus] = useState(teacher.status);

  const staffId = (teacher as any).staff_id ?? teacher.id;

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
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleSave() {
    if (!fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set("teacherId", teacher.id);
      fd.set("fullName", fullName.trim());
      fd.set("phoneNumber", phone.trim());
      fd.set("tscNumber", tscNumber.trim());
      fd.set("avatarUrl", avatarUrl);
      
      const res = await updateTeacherAction(fd);
      if (res.success) {
        // Only trigger status change if it's one of the non-archive statuses
        if (status !== teacher.status && (status === 'active' || status === 'on_leave')) {
          await changeTeacherStatusAction(teacher.id, status as any);
        }
        toast.success(res.message);
        router.refresh();
        onClose();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleArchive() {
    if (!selectedReason) {
      toast.error("Please select an archive reason");
      return;
    }

    start(async () => {
      // Passes the specific reason to the server action
      const res = await archiveTeacherAction(teacher.id, selectedReason);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
        onClose();
      } else {
        toast.error(res.message);
      }
    });
  }

  function handleResend() {
    start(async () => {
      const res = await resendTeacherInviteAction(teacher.id);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-[#0f1220] border-l border-white/[0.08] flex flex-col shadow-2xl">
        
        {/* Header Section */}
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
              aria-label="upload teacher avatar"
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

        {/* Navigation Link */}
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Personal Information */}
          <div className="space-y-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                  TSC Number
                </label>
                <input
                  type="text"
                  value={tscNumber}
                  onChange={(e) => setTscNumber(e.target.value)}
                  placeholder="e.g. 123456"
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
                  placeholder="07..."
                  className={inp}
                />
              </div>
            </div>
          </div>

          {/* Active Status Toggles (Limited to Active states) */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
              Current Duty Status
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["active", "on_leave"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  type="button"
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                    status === s 
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-400" 
                    : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:border-white/20"
                  }`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-white/20 leading-relaxed">
              To record permanent exits (transfers, resignations), use the Archive tool below.
            </p>
          </div>

          {/* Email Info */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
              Email (Account Identity)
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
              <Mail className="h-3.5 w-3.5 text-white/20 shrink-0" />
              <span className="text-sm text-white/40 font-mono truncate">
                {teacher.email}
              </span>
            </div>
          </div>

          {/* Portal Access */}
          <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.04] px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-sky-400/80">Portal Access</p>
              <p className="text-[10px] text-white/30 mt-0.5">Resend setup email.</p>
            </div>
            <button
              onClick={handleResend}
              disabled={isPending}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-sky-400/25 bg-sky-400/[0.08] px-3 py-2 text-xs font-semibold text-sky-400 hover:bg-sky-400/20 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
              Resend
            </button>
          </div>

          {/* ARCHIVE MANAGEMENT SECTION */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] overflow-hidden">
            {!archiveConfirm ? (
              <button
                onClick={() => setArchiveConfirm(true)}
                className="w-full p-4 flex items-center justify-between group hover:bg-amber-500/[0.05] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-amber-500/90 group-hover:text-amber-500">Archive Staff Member</p>
                    <p className="text-[10px] text-white/30">Handles transfers or permanent leave.</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-amber-500" />
              </button>
            ) : (
              <div className="p-4 space-y-4 bg-amber-500/[0.05]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-tight">Archive Reason Required</p>
                  </div>
                  <button 
                    onClick={() => { setArchiveConfirm(false); setSelectedReason(null); }}
                    className="text-[10px] text-white/40 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
                
                <div className="grid grid-cols-1 gap-1.5">
                  {ARCHIVE_REASONS.map((reason) => (
                    <button
                      key={reason.id}
                      onClick={() => setSelectedReason(reason.id)}
                      className={`text-left px-3 py-2.5 rounded-lg text-xs transition-all border ${
                        selectedReason === reason.id 
                          ? "bg-amber-500 text-black border-amber-500 font-bold" 
                          : "bg-white/5 text-white/60 border-transparent hover:border-white/10"
                      }`}
                    >
                      {reason.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleArchive}
                  disabled={isPending || !selectedReason}
                  className="w-full py-3 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 disabled:opacity-50 disabled:grayscale transition-all shadow-lg shadow-amber-500/20"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    `Archive as ${selectedReason ? selectedReason.replace('_', ' ') : '...'}`
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="p-4 border-t border-white/[0.06] bg-[#0f1220]">
          <button
            onClick={handleSave}
            disabled={isPending || isUploading || archiveConfirm}
            className="w-full bg-amber-400 hover:bg-amber-300 py-3 rounded-xl text-[#0c0f1a] font-bold text-sm flex justify-center items-center gap-2 transition-all shadow-lg shadow-amber-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
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