"use client";

import type {
  ChildWithAssessments,
  CommMessage,
  MessageCategory,
} from "@/lib/types/parent";
import { CATEGORY_STYLE } from "@/lib/types/parent";
import { MessageSquare, Send, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface Props {
  messages: CommMessage[];
  child: ChildWithAssessments;
  children: ChildWithAssessments[];
  parentId: string;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000)
    return d.toLocaleTimeString("en-KE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (diff < 7 * 86400000)
    return d.toLocaleDateString("en-KE", { weekday: "short" });
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

const CAT_EMOJI: Record<MessageCategory, string> = {
  general: "💬",
  behaviour: "⚠️",
  academic: "📊",
  health: "🏥",
  pastoral: "🤝",
  urgent: "🚨",
};

// Group messages by thread_id
function groupByThread(msgs: CommMessage[]): CommMessage[][] {
  const map = new Map<string, CommMessage[]>();
  for (const m of msgs) {
    const thread = m.thread_id ?? m.id;
    (map.get(thread) ?? map.set(thread, []).get(thread)!).push(m);
  }
  // Sort threads by most recent message
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(b[b.length - 1].created_at).getTime() -
      new Date(a[a.length - 1].created_at).getTime(),
  );
}

export function MessagesPageClient({
  messages,
  child,
  children,
  parentId,
}: Props) {
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<MessageCategory | "all">(
    "all",
  );

  const filtered =
    activeFilter === "all"
      ? messages
      : messages.filter((m) => m.category === activeFilter);

  const threads = groupByThread(filtered);

  // Count unread per category
  const unreadAll = messages.filter(
    (m) => !m.is_read && m.sender_role !== "parent",
  ).length;
  const categories: (MessageCategory | "all")[] = [
    "all",
    "general",
    "academic",
    "behaviour",
    "health",
    "pastoral",
    "urgent",
  ];

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-emerald-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">
              Messages{" "}
              {unreadAll > 0 && (
                <span className="ml-1 text-xs font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                  {unreadAll}
                </span>
              )}
            </p>
            <p className="text-[10px] text-slate-400 font-semibold">
              {child.full_name}
            </p>
          </div>
          {children.length > 1 && (
            <div className="flex gap-1.5">
              {children.map((c) => (
                <a
                  key={c.id}
                  href={`/parent/messages?child=${c.id}`}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    c.id === child.id
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  {c.full_name.split(" ")[0]}
                </a>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-4">
        {/* Category filters */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {categories.map((cat) => {
            const count =
              cat === "all"
                ? messages.filter(
                    (m) => !m.is_read && m.sender_role !== "parent",
                  ).length
                : messages.filter(
                    (m) =>
                      m.category === cat &&
                      !m.is_read &&
                      m.sender_role !== "parent",
                  ).length;
            const cs = cat !== "all" ? CATEGORY_STYLE[cat] : null;
            const active = activeFilter === cat;

            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={[
                  "shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all",
                  active
                    ? cs
                      ? `${cs.bg} ${cs.text} ${cs.border}`
                      : "bg-slate-800 text-white border-slate-700"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
                ].join(" ")}
              >
                {cat !== "all" && <span>{CAT_EMOJI[cat]}</span>}
                <span className="capitalize">{cat}</span>
                {count > 0 && (
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Thread list */}
        {threads.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-slate-500 font-semibold">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Your teacher communication will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {threads.map((thread) => {
              const latest = thread[thread.length - 1];
              const first = thread[0];
              const threadId = first.thread_id ?? first.id;
              const isOpen = expandedThread === threadId;
              const unread = thread.filter(
                (m) => !m.is_read && m.sender_role !== "parent",
              ).length;
              const cs = CATEGORY_STYLE[first.category];

              return (
                <div
                  key={threadId}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                >
                  {/* Thread header */}
                  <button
                    onClick={() => setExpandedThread(isOpen ? null : threadId)}
                    className="w-full flex items-start gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg shrink-0 border ${cs.bg} ${cs.border}`}
                    >
                      {CAT_EMOJI[first.category]}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 justify-between mb-0.5">
                        <p
                          className={`text-sm font-bold truncate ${unread > 0 ? "text-slate-800" : "text-slate-600"}`}
                        >
                          {first.subject ?? first.category}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {unread > 0 && (
                            <span className="text-[9px] font-black bg-emerald-500 text-white px-1.5 py-0.5 rounded-full">
                              {unread}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {formatTime(latest.created_at)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        {latest.body}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${cs.bg} ${cs.text} ${cs.border}`}
                        >
                          {first.category}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {thread.length} message
                          {thread.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-300 shrink-0 mt-1" />
                    )}
                  </button>

                  {/* Expanded thread */}
                  {isOpen && (
                    <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                      {thread.map((msg) => {
                        const isParent = msg.sender_role === "parent";
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isParent ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-3 space-y-1 ${
                                isParent
                                  ? "bg-blue-600 text-white rounded-tr-sm"
                                  : "bg-slate-100 text-slate-800 rounded-tl-sm"
                              }`}
                            >
                              {!isParent && (
                                <p
                                  className={`text-[9px] font-black uppercase tracking-wider ${isParent ? "text-blue-200" : "text-slate-400"}`}
                                >
                                  {msg.sender_name}
                                </p>
                              )}
                              <p className="text-sm leading-relaxed">
                                {msg.body}
                              </p>
                              <p
                                className={`text-[9px] ${isParent ? "text-blue-200" : "text-slate-400"}`}
                              >
                                {formatTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {/* Reply notice */}
                      <p className="text-center text-xs text-slate-400 py-2">
                        Contact the school office to send a reply ·{" "}
                        <a
                          href="mailto:admin@kibali.ac.ke"
                          className="text-blue-500 font-semibold hover:underline"
                        >
                          admin@kibali.ac.ke
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
