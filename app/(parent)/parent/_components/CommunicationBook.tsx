"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  Loader2,
  Clock,
} from "lucide-react";
import { sendMessageAction } from "@/lib/actions/parent";
import type { CommMessage, MessageCategory } from "@/lib/types/parent";

// ── Schemas ───────────────────────────────────────────────────────────────────
const composeSchema = z.object({
  subject: z.string().max(200).optional(),
  body: z.string().min(1, "Message cannot be empty").max(3000),
  category: z.enum([
    "general",
    "behaviour",
    "academic",
    "health",
    "pastoral",
    "urgent",
  ]),
});
type ComposeValues = z.infer<typeof composeSchema>;

const replySchema = z.object({
  body: z.string().min(1, "Reply cannot be empty").max(3000),
});
type ReplyValues = z.infer<typeof replySchema>;

// ── Category config — matches prototype .b-* badges ───────────────────────────
const CAT: Record<
  MessageCategory,
  { dot: string; pill: string; label: string; threadBg: string }
> = {
  general: {
    dot: "bg-slate-400",
    pill: "bg-slate-100   border-slate-200  text-slate-600",
    label: "General",
    threadBg: "bg-slate-50",
  },
  behaviour: {
    dot: "bg-amber-500",
    pill: "bg-amber-100   border-amber-200  text-amber-700",
    label: "Behaviour",
    threadBg: "bg-amber-50",
  },
  academic: {
    dot: "bg-blue-500",
    pill: "bg-blue-100    border-blue-200   text-blue-700",
    label: "Academic",
    threadBg: "bg-blue-50",
  },
  health: {
    dot: "bg-red-500",
    pill: "bg-red-100     border-red-200    text-red-700",
    label: "Health",
    threadBg: "bg-red-50",
  },
  pastoral: {
    dot: "bg-purple-500",
    pill: "bg-purple-100  border-purple-200 text-purple-700",
    label: "Pastoral",
    threadBg: "bg-purple-50",
  },
  urgent: {
    dot: "bg-red-600",
    pill: "bg-red-100     border-red-200    text-red-700",
    label: "Urgent 🚨",
    threadBg: "bg-red-50",
  },
};

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
}

function groupByThread(messages: CommMessage[]): Map<string, CommMessage[]> {
  const threads = new Map<string, CommMessage[]>();
  for (const m of messages) {
    if (!threads.has(m.thread_id)) threads.set(m.thread_id, []);
    threads.get(m.thread_id)!.push(m);
  }
  for (const [, msgs] of threads)
    msgs.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  return threads;
}

// Form input classes — matches .fg input style
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white disabled:opacity-50";
const selCls = `${inputCls} appearance-none cursor-pointer`;

interface Props {
  messages: CommMessage[];
  studentId: string;
  senderRole: "parent" | "teacher" | "admin";
}

export function CommunicationBook({ messages, studentId, senderRole }: Props) {
  const [showCompose, setShowCompose] = useState(false);
  const [expandedThread, setExpanded] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const threads = groupByThread(messages);
  const sortedThreads = [...threads.entries()].sort(
    ([, a], [, b]) =>
      new Date(b[b.length - 1]!.created_at).getTime() -
      new Date(a[a.length - 1]!.created_at).getTime(),
  );

  const {
    register: regComp,
    handleSubmit: handleComp,
    reset: resetComp,
    formState: { errors: compErr },
  } = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: { category: "general" },
  });
  const {
    register: regReply,
    handleSubmit: handleReply,
    reset: resetReply,
    formState: { errors: replyErr },
  } = useForm<ReplyValues>({ resolver: zodResolver(replySchema) });

  const onCompose = (v: ComposeValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("student_id", studentId);
      fd.append("body", v.body);
      fd.append("category", v.category);
      fd.append("is_reply", "false");
      if (v.subject) fd.append("subject", v.subject);
      const res = await sendMessageAction(fd);
      if (res.success) {
        toast.success("Message sent");
        resetComp();
        setShowCompose(false);
      } else toast.error(res.message);
    });
  };

  const onReply =
    (threadId: string, first: CommMessage) => (v: ReplyValues) => {
      startTransition(async () => {
        const fd = new FormData();
        fd.append("student_id", studentId);
        fd.append("body", v.body);
        fd.append("category", first.category);
        fd.append("thread_id", threadId);
        fd.append("is_reply", "true");
        const res = await sendMessageAction(fd);
        if (res.success) {
          toast.success("Reply sent");
          resetReply();
          setReplyingTo(null);
        } else toast.error(res.message);
      });
    };

  return (
    <div className="space-y-4">
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500">
          {threads.size} conversation{threads.size !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setShowCompose((v) => !v)}
          className={[
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 shadow-sm",
            showCompose
              ? "border border-slate-200 bg-white text-slate-500"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200",
          ].join(" ")}
        >
          {showCompose ? (
            <>
              <X className="h-3.5 w-3.5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              New Message
            </>
          )}
        </button>
      </div>

      {/* ── Compose form ───────────────────────────────────────────────────── */}
      {showCompose && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-blue-700 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            New Message to School
          </p>
          <form
            onSubmit={handleComp(onCompose)}
            noValidate
            className="space-y-3"
          >
            <input
              placeholder="Subject (optional)"
              className={inputCls}
              disabled={isPending}
              {...regComp("subject")}
            />
            <div className="relative">
              <select
                className={selCls}
                disabled={isPending}
                {...regComp("category")}
              >
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="behaviour">Behaviour</option>
                <option value="health">Health</option>
                <option value="pastoral">Pastoral</option>
                <option value="urgent">Urgent 🚨</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            </div>
            <div>
              <textarea
                rows={4}
                placeholder="Write your message…"
                className={`${inputCls} resize-none leading-relaxed`}
                disabled={isPending}
                {...regComp("body")}
              />
              {compErr.body && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  {compErr.body.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition-all active:scale-95 shadow-sm shadow-blue-200"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Message
            </button>
          </form>
        </div>
      )}

      {/* ── Thread list ────────────────────────────────────────────────────── */}
      {sortedThreads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-14 text-center">
          <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="font-bold text-slate-500">No messages yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
            Use the button above to start a conversation with the school.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedThreads.map(([threadId, msgs]) => {
            const first = msgs[0]!;
            const last = msgs[msgs.length - 1]!;
            const isOpen = expandedThread === threadId;
            const cat = CAT[first.category as MessageCategory];
            const unread = msgs.filter(
              (m) => !m.is_read && m.sender_role !== senderRole,
            ).length;

            return (
              <div
                key={threadId}
                className={[
                  "rounded-2xl border overflow-hidden transition-all shadow-sm",
                  isOpen
                    ? "border-blue-200 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300",
                ].join(" ")}
              >
                {/* Thread header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : threadId)}
                  className="w-full flex items-start gap-3 px-4 py-4 text-left"
                >
                  <div
                    className={`mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${cat.dot}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      {first.subject && (
                        <p className="text-sm font-black text-slate-800">
                          {first.subject}
                        </p>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cat.pill}`}
                      >
                        {cat.label}
                      </span>
                      {unread > 0 && (
                        <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full">
                          {unread} new
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 mb-1">
                      {last.body}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                      <Clock className="h-3 w-3" />
                      {last.sender_name} · {relativeTime(last.created_at)}
                      {msgs.length > 1 && (
                        <span className="ml-1">· {msgs.length} messages</span>
                      )}
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  )}
                </button>

                {/* Expanded body */}
                {isOpen && (
                  <div className="border-t border-blue-100 bg-white px-4 py-4 space-y-3">
                    {msgs.map((msg) => {
                      const isMine = msg.sender_role === senderRole;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={[
                              "max-w-[82%] rounded-2xl px-4 py-3 space-y-1",
                              isMine
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 border border-slate-200 text-slate-800",
                            ].join(" ")}
                          >
                            <div className="flex items-center gap-2">
                              <p
                                className={`text-[10px] font-black uppercase tracking-wider ${isMine ? "text-blue-200" : "text-slate-500"}`}
                              >
                                {msg.sender_name}
                              </p>
                              <span
                                className={`text-[10px] ${isMine ? "text-blue-300" : "text-slate-400"}`}
                              >
                                {relativeTime(msg.created_at)}
                              </span>
                            </div>
                            <p
                              className={`text-sm leading-relaxed whitespace-pre-wrap ${isMine ? "text-white" : "text-slate-700"}`}
                            >
                              {msg.body}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Reply */}
                    {replyingTo === threadId ? (
                      <form
                        onSubmit={handleReply(onReply(threadId, first))}
                        noValidate
                        className="space-y-2 pt-2 border-t border-slate-100"
                      >
                        <div>
                          <textarea
                            rows={3}
                            placeholder="Write a reply…"
                            autoFocus
                            className={`${inputCls} resize-none`}
                            disabled={isPending}
                            {...regReply("body")}
                          />
                          {replyErr.body && (
                            <p className="mt-1 text-xs font-semibold text-red-600">
                              {replyErr.body.message}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white transition-all active:scale-95"
                          >
                            {isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Send
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(null);
                              resetReply();
                            }}
                            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setReplyingTo(threadId)}
                        className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors pt-1"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Reply
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
