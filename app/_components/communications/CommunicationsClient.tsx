"use client";

import { useState, useCallback, useRef } from "react";
import {
  Send,
  Clock,
  Paperclip,
  X,
  ChevronDown,
  Users,
  User,
  GraduationCap,
  UsersRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
} from "lucide-react";
import type {
  AudienceSelection,
  AudienceType,
  AttachmentFile,
  CommunicationsClientProps,
  ComposeFormState,
  SendEmailRequest,
  SendEmailResponse,
  TemplateId,
  MessageTemplate,
} from "@/lib/types/communications";
import {
  MESSAGE_TEMPLATES,
  getTemplatesForAudience,
  AUDIENCE_LABELS,
} from "@/lib/utils/communication-templates";
import { SentHistory } from "./SentHistory";

// ── Constants ─────────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS: {
  type: AudienceType;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    type: "single_teacher",
    label: "Specific Teacher",
    icon: <User className="h-4 w-4" />,
    description: "One staff member",
  },
  {
    type: "all_teachers",
    label: "All Teachers",
    icon: <Users className="h-4 w-4" />,
    description: "Entire teaching staff",
  },
  {
    type: "single_parent",
    label: "Specific Parent",
    icon: <User className="h-4 w-4" />,
    description: "One parent or guardian",
  },
  {
    type: "all_parents",
    label: "All Parents",
    icon: <UsersRound className="h-4 w-4" />,
    description: "Every registered parent",
  },
  {
    type: "grade_parents",
    label: "Parents by Grade",
    icon: <GraduationCap className="h-4 w-4" />,
    description: "Parents of a specific class",
  },
  {
    type: "all_staff_and_parents",
    label: "Everyone",
    icon: <UsersRound className="h-4 w-4" />,
    description: "All staff and all parents",
  },
];

const DEFAULT_AUDIENCE: AudienceSelection = {
  type: "all_parents",
  individual: null,
  grade: null,
};

const DEFAULT_FORM: ComposeFormState = {
  audience: DEFAULT_AUDIENCE,
  templateId: "blank",
  subject: "",
  body: "",
  attachments: [],
  scheduledAt: null,
};

// ── Audience selector ─────────────────────────────────────────────────────────

interface AudienceSelectorProps {
  value: AudienceSelection;
  teachers: CommunicationsClientProps["recipients"]["teachers"];
  parents: CommunicationsClientProps["recipients"]["parents"];
  grades: string[];
  onChange: (v: AudienceSelection) => void;
}

function AudienceSelector({
  value,
  teachers,
  parents,
  grades,
  onChange,
}: AudienceSelectorProps) {
  const [search, setSearch] = useState<string>("");

  const selectType = (type: AudienceType) => {
    onChange({ type, individual: null, grade: null });
    setSearch("");
  };

  const needsIndividual =
    value.type === "single_teacher" || value.type === "single_parent";
  const needsGrade = value.type === "grade_parents";

  const individualPool = value.type === "single_teacher" ? teachers : parents;

  const filteredPool = search.trim()
    ? individualPool.filter(
        (p) =>
          p.full_name.toLowerCase().includes(search.toLowerCase()) ||
          p.email.toLowerCase().includes(search.toLowerCase()),
      )
    : individualPool;

  return (
    <div className="space-y-3">
      <label className="text-xs font-bold uppercase tracking-widest text-white/40">
        Audience
      </label>

      {/* Type grid */}
      <div className="grid grid-cols-2 gap-2">
        {AUDIENCE_OPTIONS.map((opt) => {
          const isActive = value.type === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => selectType(opt.type)}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all duration-200 ${
                isActive
                  ? "bg-amber-400/10 border-amber-400/40 shadow-sm shadow-amber-400/10"
                  : "bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.06]"
              }`}
            >
              <span
                className={`mt-0.5 flex-shrink-0 ${isActive ? "text-amber-400" : "text-white/30"}`}
              >
                {opt.icon}
              </span>
              <div>
                <p
                  className={`text-xs font-semibold leading-tight ${isActive ? "text-amber-400" : "text-white/60"}`}
                >
                  {opt.label}
                </p>
                <p className="text-[10px] text-white/25 mt-0.5">
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Individual picker */}
      {needsIndividual && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
            <input
              type="text"
              placeholder={`Search ${value.type === "single_teacher" ? "teachers" : "parents"}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent pl-8 pr-4 py-2.5 text-sm text-white placeholder-white/20 outline-none border-b border-white/[0.06]"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filteredPool.length === 0 ? (
              <p className="text-xs text-white/25 text-center py-4">
                No results
              </p>
            ) : (
              filteredPool.map((person) => {
                const isSelected = value.individual?.id === person.id;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => onChange({ ...value, individual: person })}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-amber-400/10 text-amber-400"
                        : "text-white/60 hover:bg-white/[0.05] hover:text-white/80"
                    }`}
                  >
                    <span className="text-xs font-medium">
                      {person.full_name}
                    </span>
                    <span className="text-[10px] text-white/30 font-mono">
                      {person.email}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Grade picker */}
      {needsGrade && (
        <div className="flex flex-wrap gap-2">
          {grades.map((grade) => {
            const isActive = value.grade === grade;
            return (
              <button
                key={grade}
                type="button"
                onClick={() => onChange({ ...value, grade })}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all duration-150 ${
                  isActive
                    ? "bg-amber-400/15 border-amber-400/40 text-amber-400"
                    : "bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:border-white/[0.15]"
                }`}
              >
                {grade}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Template picker ───────────────────────────────────────────────────────────

interface TemplateSelectorProps {
  audienceType: AudienceType;
  activeId: TemplateId;
  onSelect: (template: MessageTemplate) => void;
}

function TemplateSelector({
  audienceType,
  activeId,
  onSelect,
}: TemplateSelectorProps) {
  const templates = getTemplatesForAudience(audienceType);

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-widest text-white/40">
        Template
      </label>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
              activeId === t.id
                ? "bg-amber-400/15 border-amber-400/40 text-amber-400"
                : "bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white/70 hover:border-white/[0.14]"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Attachment uploader ───────────────────────────────────────────────────────

interface AttachmentUploaderProps {
  attachments: AttachmentFile[];
  onChange: (attachments: AttachmentFile[]) => void;
}

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB per file
const MAX_ATTACHMENTS = 5;

function AttachmentUploader({
  attachments,
  onChange,
}: AttachmentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const toAdd: AttachmentFile[] = [];

      for (const file of Array.from(files)) {
        if (attachments.length + toAdd.length >= MAX_ATTACHMENTS) break;
        if (file.size > MAX_ATTACHMENT_BYTES) continue;

        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] ?? "");
          };
          reader.readAsDataURL(file);
        });

        toAdd.push({ file, name: file.name, size: file.size, base64 });
      }

      onChange([...attachments, ...toAdd]);
    },
    [attachments, onChange],
  );

  const remove = (name: string) =>
    onChange(attachments.filter((a) => a.name !== name));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={attachments.length >= MAX_ATTACHMENTS}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 hover:text-white/70 hover:border-white/[0.15] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attach file
        </button>
        <span className="text-[10px] text-white/20">
          Max 5 MB · {attachments.length}/{MAX_ATTACHMENTS} files
        </span>
        <input
          aria-label="file"
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <div
              key={a.name}
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] px-2.5 py-1"
            >
              <Paperclip className="h-3 w-3 text-white/30" />
              <span className="text-xs text-white/60 max-w-[140px] truncate">
                {a.name}
              </span>
              <span className="text-[10px] text-white/25">
                {(a.size / 1024).toFixed(0)}KB
              </span>
              <button
                aria-label="remove name"
                type="button"
                onClick={() => remove(a.name)}
                className="text-white/25 hover:text-rose-400 transition-colors ml-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Recipient count badge ─────────────────────────────────────────────────────

function recipientCount(
  audience: AudienceSelection,
  teachers: CommunicationsClientProps["recipients"]["teachers"],
  parents: CommunicationsClientProps["recipients"]["parents"],
): string {
  switch (audience.type) {
    case "single_teacher":
    case "single_parent":
      return audience.individual ? "1 recipient" : "0 recipients";
    case "all_teachers":
      return `${teachers.length} recipients`;
    case "all_parents":
      return `${parents.length} recipients`;
    case "grade_parents":
      return audience.grade ? `Parents of ${audience.grade}` : "Select a grade";
    case "all_staff_and_parents":
      return `${teachers.length + parents.length} recipients`;
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastState =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  const isSuccess = toast.type === "success";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl transition-all duration-300 ${
        isSuccess
          ? "bg-emerald-950 border-emerald-700/40 text-emerald-300"
          : "bg-rose-950 border-rose-700/40 text-rose-300"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
      ) : (
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
      )}
      <p className="text-sm font-medium">{toast.message}</p>
      <button
        aria-label="dismiss"
        onClick={onDismiss}
        className="ml-2 text-current/50 hover:text-current transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────

export function CommunicationsClient({
  recipients,
  sentLog,
  grades,
}: CommunicationsClientProps) {
  const [form, setForm] = useState<ComposeFormState>(DEFAULT_FORM);
  const [sending, setSending] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "history">("history");
  const [showSchedule, setShowSchedule] = useState<boolean>(false);

  const update = useCallback(
    <K extends keyof ComposeFormState>(key: K, value: ComposeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const applyTemplate = useCallback((template: MessageTemplate) => {
    setForm((prev) => ({
      ...prev,
      templateId: template.id,
      subject: template.defaultSubject || prev.subject,
      body: template.defaultBody || prev.body,
    }));
  }, []);

  const handleSend = useCallback(async () => {
    if (!form.subject.trim() || !form.body.trim()) {
      setToast({ type: "error", message: "Subject and body are required." });
      return;
    }
    if (
      (form.audience.type === "single_teacher" ||
        form.audience.type === "single_parent") &&
      form.audience.individual === null
    ) {
      setToast({ type: "error", message: "Please select a recipient." });
      return;
    }
    if (
      form.audience.type === "grade_parents" &&
      form.audience.grade === null
    ) {
      setToast({ type: "error", message: "Please select a grade." });
      return;
    }

    setSending(true);

    const payload: SendEmailRequest = {
      audience: form.audience,
      subject: form.subject,
      body: form.body,
      attachments: form.attachments.map((a) => ({
        name: a.name,
        base64: a.base64,
        mimeType: a.file.type,
      })),
      scheduledAt: form.scheduledAt,
    };

    try {
      const res = await fetch("/api/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as SendEmailResponse;

      if (data.success) {
        const isScheduled = form.scheduledAt !== null;
        setToast({
          type: "success",
          message: isScheduled
            ? `Scheduled for ${new Date(form.scheduledAt!).toLocaleString()}.`
            : `Sent to ${data.recipientCount} recipient${data.recipientCount !== 1 ? "s" : ""} successfully.`,
        });
        setForm(DEFAULT_FORM);
        setShowSchedule(false);
        setActiveTab("history");
      } else {
        setToast({
          type: "error",
          message: data.error ?? "Something went wrong.",
        });
      }
    } catch {
      setToast({ type: "error", message: "Network error. Please try again." });
    } finally {
      setSending(false);
    }
  }, [form]);

  const count = recipientCount(
    form.audience,
    recipients.teachers,
    recipients.parents,
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 h-full">
      {/* ── LEFT: Composer ── */}
      <div className="space-y-5">
        {/* Audience */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-5">
          <AudienceSelector
            value={form.audience}
            teachers={recipients.teachers}
            parents={recipients.parents}
            grades={grades}
            onChange={(audience) => update("audience", audience)}
          />

          {/* Recipient count pill */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 px-3 py-1">
              <Users className="h-3 w-3 text-amber-400" />
              <span className="text-xs font-semibold text-amber-400">
                {count}
              </span>
            </div>
          </div>
        </div>

        {/* Templates */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <TemplateSelector
            audienceType={form.audience.type}
            activeId={form.templateId}
            onSelect={applyTemplate}
          />
        </div>

        {/* Subject + Body */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
          <label className="text-xs font-bold uppercase tracking-widest text-white/40">
            Message
          </label>

          <input
            type="text"
            placeholder="Subject line…"
            value={form.subject}
            onChange={(e) => update("subject", e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/40 focus:bg-white/[0.06] transition-all duration-200 font-medium"
          />

          <textarea
            placeholder="Write your message here…"
            value={form.body}
            onChange={(e) => update("body", e.target.value)}
            rows={12}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none focus:border-amber-400/40 focus:bg-white/[0.06] transition-all duration-200 resize-none leading-relaxed"
          />

          {/* Attachments */}
          <AttachmentUploader
            attachments={form.attachments}
            onChange={(attachments) => update("attachments", attachments)}
          />
        </div>

        {/* Scheduling + Send */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
          {/* Schedule toggle */}
          <button
            type="button"
            onClick={() => setShowSchedule((s) => !s)}
            className="flex items-center gap-2 text-xs font-semibold text-white/40 hover:text-white/70 transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            {showSchedule ? "Send immediately instead" : "Schedule for later"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${showSchedule ? "rotate-180" : ""}`}
            />
          </button>

          {showSchedule && (
            <div className="space-y-2">
              <label className="text-xs text-white/30 font-medium">
                Send at
              </label>
              <input
                aria-label="submitted at"
                type="datetime-local"
                value={form.scheduledAt ?? ""}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => update("scheduledAt", e.target.value || null)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white/70 outline-none focus:border-amber-400/40 transition-all duration-200"
              />
            </div>
          )}

          {/* Send button */}
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 px-6 py-3 text-sm font-bold text-[#0c0f1a] shadow-lg shadow-amber-400/20"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending
              ? "Sending…"
              : form.scheduledAt
                ? "Schedule Message"
                : `Send to ${count}`}
          </button>
        </div>
      </div>

      {/* ── RIGHT: History / Preview panel ── */}
      <div className="space-y-4">
        {/* Tab switcher */}
        <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
          {(["history", "preview"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all duration-200 ${
                activeTab === tab
                  ? "bg-white/[0.08] text-white"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {tab === "history" ? "Sent History" : "Message Preview"}
            </button>
          ))}
        </div>

        {activeTab === "history" ? (
          <SentHistory log={sentLog} />
        ) : (
          <MessagePreview form={form} />
        )}
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

// ── Message preview ───────────────────────────────────────────────────────────

function MessagePreview({ form }: { form: ComposeFormState }) {
  if (!form.subject && !form.body) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-10 text-center">
        <p className="text-3xl mb-3">✉️</p>
        <p className="text-white/30 text-sm">
          Start writing to see a preview here
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Mock email header */}
      <div className="bg-amber-500/10 border-b border-amber-400/10 px-5 py-4">
        <p className="text-[10px] text-amber-400/60 uppercase tracking-widest font-bold">
          Kibali Academy
        </p>
        <p className="text-sm font-bold text-white mt-0.5">
          {form.subject || "No subject"}
        </p>
        <p className="text-[11px] text-white/30 mt-1">
          To: {AUDIENCE_LABELS[form.audience.type]}
          {form.audience.individual
            ? ` — ${form.audience.individual.full_name}`
            : ""}
          {form.audience.grade ? ` — ${form.audience.grade}` : ""}
        </p>
      </div>
      <div className="p-5">
        <pre className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap font-sans">
          {form.body || "No body yet"}
        </pre>
        {form.attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            <p className="text-[10px] text-white/25 uppercase tracking-wider mb-2">
              Attachments
            </p>
            {form.attachments.map((a) => (
              <div
                key={a.name}
                className="flex items-center gap-2 text-xs text-white/40"
              >
                <Paperclip className="h-3 w-3" />
                {a.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
