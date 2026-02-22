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
import { CATEGORY_STYLE } from "@/lib/types/parent";

// ── Schema ────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  for (const msg of messages) {
    if (!threads.has(msg.thread_id)) threads.set(msg.thread_id, []);
    threads.get(msg.thread_id)!.push(msg);
  }
  // Sort messages within each thread oldest-first
  for (const [, msgs] of threads) {
    msgs.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }
  return threads;
}

// ── Component ─────────────────────────────────────────────────────────────────

const inp =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-sky-400/50 focus:ring-2 focus:ring-sky-400/20 disabled:opacity-50";
const sel = `${inp} appearance-none cursor-pointer`;

interface Props {
  messages: CommMessage[];
  studentId: string;
  senderRole: "parent" | "teacher" | "admin";
}

export function CommunicationBook({ messages, studentId, senderRole }: Props) {
  const [showCompose, setShowCompose] = useState(false);
  const [expandedThread, setExpanded] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null); // thread_id
  const [isPending, startTransition] = useTransition();

  const threads = groupByThread(messages);

  // Sort threads by latest message
  const sortedThreads = [...threads.entries()].sort(([, a], [, b]) => {
    const latestA = a[a.length - 1]!.created_at;
    const latestB = b[b.length - 1]!.created_at;
    return new Date(latestB).getTime() - new Date(latestA).getTime();
  });

  // Compose form
  const {
    register: regComp,
    handleSubmit: handleComp,
    reset: resetComp,
    formState: { errors: compErr },
  } = useForm<ComposeValues>({
    resolver: zodResolver(composeSchema),
    defaultValues: { category: "general" },
  });

  // Reply form
  const {
    register: regReply,
    handleSubmit: handleReply,
    reset: resetReply,
    formState: { errors: replyErr },
  } = useForm<ReplyValues>({ resolver: zodResolver(replySchema) });

  const onCompose = (values: ComposeValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("student_id", studentId);
      fd.append("body", values.body);
      fd.append("category", values.category);
      fd.append("is_reply", "false");
      if (values.subject) fd.append("subject", values.subject);
      const res = await sendMessageAction(fd);
      if (res.success) {
        toast.success("Message sent");
        resetComp();
        setShowCompose(false);
      } else toast.error(res.message);
    });
  };

  const onReply =
    (threadId: string, firstMsg: CommMessage) => (values: ReplyValues) => {
      startTransition(async () => {
        const fd = new FormData();
        fd.append("student_id", studentId);
        fd.append("body", values.body);
        fd.append("category", firstMsg.category);
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
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/40">
          {threads.size} conversation{threads.size !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => setShowCompose((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 active:scale-95 px-4 py-2 text-xs font-bold text-white transition-all"
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

      {/* Compose */}
      {showCompose && (
        <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/70 flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" /> New Message to School
          </p>
          <form
            onSubmit={handleComp(onCompose)}
            noValidate
            className="space-y-3"
          >
            <input
              placeholder="Subject (optional)"
              className={inp}
              disabled={isPending}
              {...regComp("subject")}
            />
            <div className="relative">
              <select
                className={sel}
                disabled={isPending}
                {...regComp("category")}
              >
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="behaviour">Behaviour</option>
                <option value="health">Health</option>
                <option value="pastoral">Pastoral</option>
                <option value="urgent">🚨 Urgent</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            </div>
            <div>
              <textarea
                rows={4}
                placeholder="Write your message…"
                className={`${inp} resize-none leading-relaxed`}
                disabled={isPending}
                {...regComp("body")}
              />
              {compErr.body && (
                <p className="mt-1 text-xs text-rose-400">
                  {compErr.body.message}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition-all"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </button>
          </form>
        </div>
      )}

      {/* Thread list */}
      {sortedThreads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-3xl mb-2">💬</p>
          <p className="text-sm text-white/40">No messages yet</p>
          <p className="text-xs text-white/25 mt-1">
            Use the button above to send a message to the school.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedThreads.map(([threadId, msgs]) => {
            const first = msgs[0]!;
            const last = msgs[msgs.length - 1]!;
            const isOpen = expandedThread === threadId;
            const catStyle = CATEGORY_STYLE[first.category as MessageCategory];
            const unread = msgs.filter(
              (m) => !m.is_read && m.sender_role !== senderRole,
            ).length;

            return (
              <div
                key={threadId}
                className={`rounded-2xl border transition-all ${isOpen ? "border-white/15 bg-white/[0.04]" : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.03]"}`}
              >
                {/* Thread header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : threadId)}
                  className="w-full flex items-start gap-3 px-5 py-4 text-left"
                >
                  <div
                    className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${catStyle.bg.replace("bg-", "bg-").replace("/10", "/60")}`}
                    style={{
                      background: catStyle.text.includes("sky")
                        ? "#38bdf8"
                        : catStyle.text.includes("amber")
                          ? "#fbbf24"
                          : catStyle.text.includes("rose")
                            ? "#fb7185"
                            : catStyle.text.includes("purple")
                              ? "#c084fc"
                              : catStyle.text.includes("emerald")
                                ? "#34d399"
                                : "#fff",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {first.subject && (
                        <p className="text-sm font-semibold text-white">
                          {first.subject}
                        </p>
                      )}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                      >
                        {first.category}
                      </span>
                      {unread > 0 && (
                        <span className="text-[10px] font-bold bg-sky-500 text-white px-1.5 py-0.5 rounded-full">
                          {unread} new
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-white/45 mt-1 line-clamp-1">
                      {last.body}
                    </p>
                    <p className="text-[10px] text-white/25 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {last.sender_name} · {relativeTime(last.created_at)}
                      {msgs.length > 1 && (
                        <span className="ml-1 opacity-60">
                          · {msgs.length} messages
                        </span>
                      )}
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-white/30 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/30 flex-shrink-0 mt-0.5" />
                  )}
                </button>

                {/* Expanded thread */}
                {isOpen && (
                  <div className="border-t border-white/[0.07] px-5 py-4 space-y-4">
                    {/* Messages */}
                    {msgs.map((msg) => {
                      const isMine = msg.sender_role === senderRole;
                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1 ${
                              isMine
                                ? "bg-sky-500/15 border border-sky-500/25"
                                : "bg-white/[0.05] border border-white/[0.08]"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <p
                                className={`text-[10px] font-semibold uppercase tracking-wider ${isMine ? "text-sky-400" : "text-white/40"}`}
                              >
                                {msg.sender_name}
                              </p>
                              <span className="text-[10px] text-white/25">
                                {relativeTime(msg.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                              {msg.body}
                            </p>
                          </div>
                        </div>
                      );
                    })}

                    {/* Reply form */}
                    {replyingTo === threadId ? (
                      <form
                        onSubmit={handleReply(onReply(threadId, first))}
                        noValidate
                        className="space-y-2 pt-2 border-t border-white/[0.07]"
                      >
                        <div>
                          <textarea
                            rows={3}
                            placeholder="Write a reply…"
                            autoFocus
                            className={`${inp} resize-none`}
                            disabled={isPending}
                            {...regReply("body")}
                          />
                          {replyErr.body && (
                            <p className="mt-1 text-xs text-rose-400">
                              {replyErr.body.message}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white transition-all"
                          >
                            {isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="h-3.5 w-3.5" />
                            )}
                            Send Reply
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo(null);
                              resetReply();
                            }}
                            className="px-3 py-2 rounded-xl border border-white/10 text-xs text-white/40 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setReplyingTo(threadId)}
                        className="flex items-center gap-2 text-xs text-sky-400/70 hover:text-sky-400 transition-colors pt-1"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Reply
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
