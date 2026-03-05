"use client";
// components/governance/AnnouncementsPanel.tsx
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Megaphone, Bell, Pin, PinOff, Trash2, Loader2,
  Plus, X, ChevronDown, Users, AlertTriangle,
} from "lucide-react";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  togglePinAction,
} from "@/lib/actions/governance";
import type { Announcement, AnnouncementPriority, AnnouncementAudience } from "@/lib/types/governance";
import { ALL_GRADES } from "@/lib/types/allocation";

const PRIORITY_STYLE: Record<AnnouncementPriority, string> = {
  low:    "text-white/40  border-white/10       bg-white/5",
  normal: "text-sky-400   border-sky-400/25     bg-sky-400/10",
  high:   "text-amber-400 border-amber-400/25   bg-amber-400/10",
  urgent: "text-rose-400  border-rose-400/25    bg-rose-400/10",
};

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  all: "Everyone", parents: "Parents only",
  teachers: "Teachers only", grade: "Specific grade",
};

const field  = "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50";
const selCls = `${field} appearance-none cursor-pointer`;

const schema = z.object({
  title:        z.string().min(2, "Title required").max(200),
  body:         z.string().min(10, "Message too short (min 10 chars)").max(10_000),
  audience:     z.enum(["all", "parents", "teachers", "grade"]),
  target_grade: z.string().optional(),
  priority:     z.enum(["low", "normal", "high", "urgent"]),
  pinned:       z.boolean(),
  expires_at:   z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props { announcements: Announcement[] }

export function AnnouncementsPanel({ announcements }: Props) {
  const [showCompose, setShowCompose] = useState(false);
  const [isPending, startTransition]  = useTransition();

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { audience: "all", priority: "normal", pinned: false },
  });
  const audience = watch("audience");

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      const res = await createAnnouncementAction(fd);
      if (res.success) { toast.success("Published", { description: "Announcement is now live.", icon: "📢" }); reset(); setShowCompose(false); }
      else toast.error("Failed to publish", { description: res.message });
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteAnnouncementAction(id);
      res.success ? toast.success("Deleted") : toast.error(res.message);
    });
  };

  const handlePin = (id: string, pinned: boolean) => {
    startTransition(async () => {
      const res = await togglePinAction(id, pinned);
      res.success ? toast.success(res.message) : toast.error(res.message);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-white/40">{announcements.length} announcement{announcements.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowCompose(v => !v)}
          className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 px-4 py-2 text-xs font-bold text-[#0c0f1a] transition-all">
          {showCompose ? <><X className="h-3.5 w-3.5" />Cancel</> : <><Plus className="h-3.5 w-3.5" />New Announcement</>}
        </button>
      </div>

      {showCompose && (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70 flex items-center gap-2">
            <Megaphone className="h-3.5 w-3.5" />Compose Announcement
          </p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            <div>
              <input placeholder="Announcement title *" className={field} disabled={isPending} {...register("title")} />
              {errors.title && <p className="mt-1 text-xs text-rose-400">{errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <select className={selCls} disabled={isPending} {...register("audience")}>
                  <option value="all">📣 Everyone</option>
                  <option value="parents">👪 Parents only</option>
                  <option value="teachers">📋 Teachers only</option>
                  <option value="grade">🎓 Specific grade</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
              <div className="relative">
                <select className={selCls} disabled={isPending} {...register("priority")}>
                  <option value="low">Low priority</option>
                  <option value="normal">Normal</option>
                  <option value="high">⚡ High priority</option>
                  <option value="urgent">🚨 Urgent</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            </div>
            {audience === "grade" && (
              <div className="relative">
                <select className={selCls} disabled={isPending} {...register("target_grade")}>
                  <option value="">Select grade…</option>
                  {ALL_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            )}
            <div>
              <textarea rows={4} placeholder="Write your announcement… (min 10 characters)"
                className={`${field} resize-none leading-relaxed`} disabled={isPending} {...register("body")} />
              {errors.body && <p className="mt-1 text-xs text-rose-400">{errors.body.message}</p>}
            </div>
            <div className="flex flex-wrap items-end gap-5">
              <div className="flex-1 min-w-[180px]">
                <label className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">Expires (optional)</label>
                <input type="datetime-local" className={`${field} [color-scheme:dark]`} disabled={isPending} {...register("expires_at")} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-2.5">
                <input type="checkbox" className="rounded accent-amber-400" disabled={isPending} {...register("pinned")} />
                <span className="text-sm text-white/60 flex items-center gap-1.5">
                  <Pin className="h-3.5 w-3.5 text-amber-400" />Pin to top
                </span>
              </label>
            </div>
            <button type="submit" disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 active:scale-95 px-5 py-2.5 text-sm font-bold text-[#0c0f1a] transition-all">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
              Publish
            </button>
          </form>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-white/10 text-center px-6">
          <p className="text-4xl mb-3">📢</p>
          <p className="text-white/50 font-medium">No announcements yet</p>
          <p className="text-white/25 text-sm mt-1 max-w-xs">Publish one above to notify parents, teachers or specific grades.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id}
              className={`rounded-2xl border bg-white/[0.02] hover:bg-white/[0.04] p-5 transition-colors ${a.pinned ? "border-amber-400/30" : "border-white/[0.07]"}`}>
              <div className="flex items-start gap-3">
                {a.pinned && <Pin className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-semibold text-white">{a.title}</p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${PRIORITY_STYLE[a.priority]}`}>
                      {a.priority}
                    </span>
                    <span className="text-[10px] text-white/30 border border-white/10 rounded-md px-2 py-0.5 flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {AUDIENCE_LABEL[a.audience]}{a.target_grade ? ` · ${a.target_grade}` : ""}
                    </span>
                    {a.expires_at && new Date(a.expires_at) < new Date() && (
                      <span className="text-[10px] text-white/25 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />Expired
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white/55 leading-relaxed line-clamp-3">{a.body}</p>
                  <p className="text-xs text-white/25 mt-2">
                    {a.profiles?.full_name ?? "Admin"} · {new Date(a.published_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    {a.expires_at && ` · Expires ${new Date(a.expires_at).toLocaleDateString("en-KE")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => handlePin(a.id, a.pinned)} disabled={isPending} title={a.pinned ? "Unpin" : "Pin to top"}
                    className="p-1.5 rounded-lg hover:bg-amber-400/10 text-white/30 hover:text-amber-400 transition-colors">
                    {a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>
                  <button onClick={() => handleDelete(a.id, a.title)} disabled={isPending} title="Delete"
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-white/30 hover:text-rose-400 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}