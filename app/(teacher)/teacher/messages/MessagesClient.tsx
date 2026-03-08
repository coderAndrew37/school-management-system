"use client";

// app/teacher/messages/MessagesClient.tsx

import { useState, useTransition } from "react";
import { sendParentNotificationAction } from "@/lib/actions/teacher";
import type { ClassStudent } from "@/lib/data/assessment";

// ── Types ─────────────────────────────────────────────────────────────────────

type MsgType = "info" | "warning" | "success";

interface RecentMessage {
  id: string;
  student_id: string;
  student_name: string;
  grade: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  teacherName: string;
  grades: string[];
  studentsByGrade: Record<string, ClassStudent[]>;
  recentMessages: RecentMessage[];
}

// ── Config ────────────────────────────────────────────────────────────────────

const MSG_TYPES: {
  value: MsgType;
  label: string;
  icon: string;
  style: string;
  activeStyle: string;
}[] = [
  {
    value: "info",
    label: "General",
    icon: "💬",
    style: "border-slate-200 text-slate-600 hover:border-slate-300",
    activeStyle: "bg-sky-50 border-sky-400 text-sky-700",
  },
  {
    value: "success",
    label: "Academic",
    icon: "📚",
    style: "border-slate-200 text-slate-600 hover:border-slate-300",
    activeStyle: "bg-emerald-50 border-emerald-400 text-emerald-700",
  },
  {
    value: "warning",
    label: "Behavioral",
    icon: "⚠️",
    style: "border-slate-200 text-slate-600 hover:border-slate-300",
    activeStyle: "bg-amber-50 border-amber-400 text-amber-700",
  },
];

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> =
  {
    info: { bg: "bg-sky-50", text: "text-sky-600", label: "General" },
    success: {
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      label: "Academic",
    },
    warning: { bg: "bg-amber-50", text: "text-amber-600", label: "Behavioral" },
  };

const QUICK_TITLES = [
  "Great progress this week!",
  "Please review today's homework.",
  "Missed today's class.",
  "Excellent performance in assessment.",
  "Needs extra support — please follow up.",
  "Assignment submitted late.",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1) return "Just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MessagesClient({
  teacherName,
  grades,
  studentsByGrade,
  recentMessages,
}: Props) {
  const [selectedGrade, setSelectedGrade] = useState(grades[0] ?? "");
  const [studentId, setStudentId] = useState("");
  const [msgType, setMsgType] = useState<MsgType>("info");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [messages, setMessages] = useState<RecentMessage[]>(recentMessages);
  const [filterType, setFilterType] = useState<string>("all");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  const students = studentsByGrade[selectedGrade] ?? [];

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function resetForm() {
    setStudentId("");
    setTitle("");
    setBody("");
    setMsgType("info");
  }

  function handleQuickTitle(t: string) {
    setTitle(t);
  }

  function handleSend() {
    if (!studentId) {
      showToast("Please select a student.", false);
      return;
    }
    if (!title.trim()) {
      showToast("Please enter a message title.", false);
      return;
    }
    if (!body.trim()) {
      showToast("Please enter a message body.", false);
      return;
    }

    startTransition(async () => {
      const result = await sendParentNotificationAction(
        studentId,
        title,
        body,
        msgType,
      );

      if (result.success) {
        showToast("Message sent to parent.", true);
        const student = students.find((s) => s.id === studentId);
        const optimistic: RecentMessage = {
          id: `temp-${Date.now()}`,
          student_id: studentId,
          student_name: student?.full_name ?? "Unknown",
          grade: selectedGrade,
          title,
          body,
          type: msgType,
          is_read: false,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [optimistic, ...prev]);
        resetForm();
      } else {
        showToast(result.message, false);
      }
    });
  }

  const filteredMessages =
    filterType === "all"
      ? messages
      : messages.filter((m) => m.type === filterType);

  return (
    <div className="min-h-screen bg-[#F8F7F2]">
      {/* ── Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              Communication Book
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {teacherName} · Messages to parents
            </p>
          </div>
          <a
            href="/teacher"
            className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Dashboard
          </a>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg transition-all ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        {/* ── LEFT: Compose ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">
                New Message
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Delivered to parent portal immediately
              </p>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Grade tabs */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Class
                </label>
                <div className="flex flex-wrap gap-2">
                  {grades.map((g) => (
                    <button
                      key={g}
                      onClick={() => {
                        setSelectedGrade(g);
                        setStudentId("");
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        selectedGrade === g
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Student */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Student
                </label>
                <select
                  aria-label="select student for messaging"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">— Select student —</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Message type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Type
                </label>
                <div className="flex gap-2">
                  {MSG_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setMsgType(t.value)}
                      className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-all ${
                        msgType === t.value ? t.activeStyle : t.style
                      }`}
                    >
                      <span className="mr-1">{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick titles */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Message subject"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 placeholder-slate-300"
                />
                {/* Quick templates */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {QUICK_TITLES.map((t) => (
                    <button
                      key={t}
                      onClick={() => handleQuickTitle(t)}
                      className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">
                  Message
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message to the parent…"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none placeholder-slate-300"
                />
                <p className="text-xs text-slate-300 mt-1 text-right">
                  {body.length} chars
                </p>
              </div>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleSend}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                  />
                </svg>
                {isPending ? "Sending…" : "Send to Parent"}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Sent messages ── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
              Filter:
            </span>
            {["all", "info", "success", "warning"].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                  filterType === t
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                {t === "all" ? "All" : (TYPE_BADGE[t]?.label ?? t)}
              </button>
            ))}
            <span className="ml-auto text-xs text-slate-400">
              {filteredMessages.length} messages
            </span>
          </div>

          {filteredMessages.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm">No messages sent yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMessages.map((msg) => {
                const badge = TYPE_BADGE[msg.type] ?? TYPE_BADGE.info;
                return (
                  <div
                    key={msg.id}
                    className="bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {msg.title}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {msg.student_name} · {msg.grade}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} border-current/20`}
                            >
                              {badge.label}
                            </span>
                            {!msg.is_read && (
                              <span
                                className="w-2 h-2 rounded-full bg-emerald-400"
                                title="Unread"
                              />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-slate-500 mt-1.5 line-clamp-2">
                          {msg.body}
                        </p>
                        <p className="text-xs text-slate-300 mt-2">
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
