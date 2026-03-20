"use client";

// app/_components/communications/CommunicationsClient.tsx

import type {
  AttachmentFile,
  AudienceSelection,
  AudienceType,
  CommunicationsClientProps,
  ComposeFormState,
  MessageTemplate,
  SendChannel,
  SendEmailRequest,
  SendEmailResponse,
  SmsTemplate,
  SmsTemplateId,
  TemplateId,
} from "@/lib/types/communications";
import {
  AUDIENCE_LABELS,
  getTemplatesForAudience,
  getSmsTemplatesForAudience,
} from "@/lib/utils/communication-templates";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  GraduationCap,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  User,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { SentHistory } from "./SentHistory";

// ── Constants ─────────────────────────────────────────────────────────────────

const SMS_SINGLE = 160;
const SMS_MULTI = 153; // GSM 7-bit multi-part
const SMS_MAX_PARTS = 3;

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
  channel: "email",
  audience: DEFAULT_AUDIENCE,
  templateId: "blank",
  smsTemplateId: "sms_blank",
  subject: "",
  body: "",
  attachments: [],
  scheduledAt: null,
};

// ── Channel toggle ────────────────────────────────────────────────────────────

function ChannelToggle({
  value,
  onChange,
}: {
  value: SendChannel;
  onChange: (v: SendChannel) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl border border-white/[0.08] bg-white/[0.03] w-fit">
      {(["email", "sms"] as SendChannel[]).map((ch) => {
        const active = value === ch;
        return (
          <button
            key={ch}
            type="button"
            onClick={() => onChange(ch)}
            className={[
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              active
                ? ch === "email"
                  ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                  : "bg-sky-400/15 border border-sky-400/30 text-sky-400"
                : "text-white/35 hover:text-white/60",
            ].join(" ")}
          >
            {ch === "email" ? (
              <Mail className="h-3.5 w-3.5" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5" />
            )}
            {ch === "email" ? "Email" : "SMS"}
          </button>
        );
      })}
    </div>
  );
}

// ── Audience selector ─────────────────────────────────────────────────────────

function AudienceSelector({
  value,
  teachers,
  parents,
  grades,
  onChange,
}: {
  value: AudienceSelection;
  teachers: CommunicationsClientProps["recipients"]["teachers"];
  parents: CommunicationsClientProps["recipients"]["parents"];
  grades: string[];
  onChange: (v: AudienceSelection) => void;
}) {
  const [search, setSearch] = useState("");

  const needsIndividual =
    value.type === "single_teacher" || value.type === "single_parent";
  const needsGrade = value.type === "grade_parents";
  const pool = value.type === "single_teacher" ? teachers : parents;
  const filtered = search.trim()
    ? pool.filter(
        (p) =>
          p.full_name.toLowerCase().includes(search.toLowerCase()) ||
          p.email.toLowerCase().includes(search.toLowerCase()),
      )
    : pool;

  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase tracking-widest text-white/35">
        Audience
      </label>
      <div className="grid grid-cols-2 gap-2">
        {AUDIENCE_OPTIONS.map((opt) => {
          const active = value.type === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => {
                onChange({ type: opt.type, individual: null, grade: null });
                setSearch("");
              }}
              className={[
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all",
                active
                  ? "bg-amber-400/10 border-amber-400/30 shadow-sm shadow-amber-400/10"
                  : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]",
              ].join(" ")}
            >
              <span
                className={`mt-0.5 shrink-0 ${active ? "text-amber-400" : "text-white/25"}`}
              >
                {opt.icon}
              </span>
              <div>
                <p
                  className={`text-xs font-semibold leading-tight ${active ? "text-amber-400" : "text-white/55"}`}
                >
                  {opt.label}
                </p>
                <p className="text-[10px] text-white/20 mt-0.5">
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {needsIndividual && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="relative border-b border-white/[0.05]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${value.type === "single_teacher" ? "teachers" : "parents"}…`}
              className="w-full bg-transparent pl-8 pr-4 py-2.5 text-sm text-white placeholder-white/15 outline-none"
            />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-white/20 text-center py-4">
                No results
              </p>
            ) : (
              filtered.map((p) => {
                const isSelected = value.individual?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onChange({ ...value, individual: p })}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-amber-400/10 text-amber-400"
                        : "text-white/50 hover:bg-white/[0.04] hover:text-white/75"
                    }`}
                  >
                    <span className="text-xs font-medium">{p.full_name}</span>
                    <span className="text-[10px] text-white/25 font-mono truncate max-w-[160px]">
                      {p.email}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {needsGrade && (
        <div className="flex flex-wrap gap-2">
          {grades.map((grade) => {
            const active = value.grade === grade;
            return (
              <button
                key={grade}
                type="button"
                onClick={() => onChange({ ...value, grade })}
                className={[
                  "rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all",
                  active
                    ? "bg-amber-400/15 border-amber-400/35 text-amber-400"
                    : "bg-white/[0.03] border-white/[0.07] text-white/35 hover:text-white/65 hover:border-white/[0.14]",
                ].join(" ")}
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

function TemplateSelector({
  audienceType,
  activeId,
  onSelect,
}: {
  audienceType: AudienceType;
  activeId: TemplateId;
  onSelect: (t: MessageTemplate) => void;
}) {
  const templates = getTemplatesForAudience(audienceType);
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-white/35">
        Template
      </label>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={[
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
              activeId === t.id
                ? "bg-amber-400/15 border-amber-400/35 text-amber-400"
                : "bg-white/[0.02] border-white/[0.06] text-white/35 hover:text-white/65 hover:border-white/[0.12]",
            ].join(" ")}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SMS Template selector ─────────────────────────────────────────────────────

function SmsTemplateSelector({
  audienceType,
  activeId,
  onSelect,
}: {
  audienceType: AudienceType;
  activeId: SmsTemplateId;
  onSelect: (t: SmsTemplate) => void;
}) {
  const templates = getSmsTemplatesForAudience(audienceType);
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-white/35">
        Template
      </label>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const active = activeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className={[
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                active
                  ? "bg-sky-400/15 border-sky-400/35 text-sky-400"
                  : "bg-white/[0.02] border-white/[0.06] text-white/35 hover:text-white/65 hover:border-white/[0.12]",
              ].join(" ")}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.charHint > 0 && (
                <span
                  className={`text-[9px] font-mono ml-0.5 ${
                    active ? "text-sky-400/60" : "text-white/20"
                  }`}
                >
                  {t.charHint}c
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Attachment uploader ───────────────────────────────────────────────────────

function AttachmentUploader({
  attachments,
  onChange,
}: {
  attachments: AttachmentFile[];
  onChange: (v: AttachmentFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      const toAdd: AttachmentFile[] = [];
      for (const file of Array.from(files)) {
        if (attachments.length + toAdd.length >= 5) break;
        if (file.size > 5 * 1024 * 1024) continue;
        const base64 = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res((r.result as string).split(",")[1] ?? "");
          r.readAsDataURL(file);
        });
        toAdd.push({ file, name: file.name, size: file.size, base64 });
      }
      onChange([...attachments, ...toAdd]);
    },
    [attachments, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={attachments.length >= 5}
          className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-white/35 hover:text-white/65 hover:border-white/[0.14] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attach file
        </button>
        <span className="text-[10px] text-white/15">
          Max 5 MB · {attachments.length}/5
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
              className="flex items-center gap-1.5 rounded-lg bg-white/[0.05] border border-white/[0.07] px-2.5 py-1"
            >
              <Paperclip className="h-3 w-3 text-white/25" />
              <span className="text-xs text-white/50 max-w-[140px] truncate">
                {a.name}
              </span>
              <span className="text-[10px] text-white/20">
                {(a.size / 1024).toFixed(0)}KB
              </span>
              <button
                aria-label="remove"
                type="button"
                onClick={() =>
                  onChange(attachments.filter((x) => x.name !== a.name))
                }
                className="text-white/20 hover:text-rose-400 transition-colors ml-0.5"
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

// ── SMS char counter ──────────────────────────────────────────────────────────

function SmsCounter({ length }: { length: number }) {
  const parts = length <= SMS_SINGLE ? 1 : Math.ceil(length / SMS_MULTI);
  const limit = parts <= 1 ? SMS_SINGLE : SMS_MULTI * SMS_MAX_PARTS;
  const over = length > limit;
  return (
    <div
      className={`flex items-center justify-between text-[10px] ${over ? "text-rose-400" : "text-white/25"}`}
    >
      <span>{parts > 1 ? `${parts} SMS parts` : "1 SMS"}</span>
      <span className={over ? "text-rose-400 font-bold" : ""}>
        {length}/{limit}
        {over ? " — too long" : ""}
      </span>
    </div>
  );
}

// ── Recipient count ───────────────────────────────────────────────────────────

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

type ToastState = { type: "success" | "error"; message: string } | null;

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  if (!toast) return null;
  const ok = toast.type === "success";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3.5 shadow-2xl transition-all ${
        ok
          ? "bg-emerald-950 border-emerald-700/40 text-emerald-300"
          : "bg-rose-950 border-rose-700/40 text-rose-300"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="h-5 w-5 shrink-0" />
      ) : (
        <AlertCircle className="h-5 w-5 shrink-0" />
      )}
      <p className="text-sm font-medium">{toast.message}</p>
      <button
        aria-label="dismiss"
        onClick={onDismiss}
        className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CommunicationsClient({
  recipients,
  sentLog,
  grades,
}: CommunicationsClientProps) {
  const [form, setForm] = useState<ComposeFormState>(DEFAULT_FORM);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [activeTab, setActiveTab] = useState<"preview" | "history">("history");
  const [showSchedule, setShowSchedule] = useState(false);

  const update = useCallback(
    <K extends keyof ComposeFormState>(key: K, value: ComposeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleChannelChange = (ch: SendChannel) => {
    setForm((prev) => ({
      ...prev,
      channel: ch,
      // Clear attachments when switching to SMS
      attachments: ch === "sms" ? [] : prev.attachments,
    }));
  };

  const applyTemplate = useCallback((t: MessageTemplate) => {
    setForm((prev) => ({
      ...prev,
      templateId: t.id,
      subject: t.defaultSubject || prev.subject,
      body: t.defaultBody || prev.body,
    }));
  }, []);

  const applySmsTemplate = useCallback((t: SmsTemplate) => {
    setForm((prev) => ({
      ...prev,
      smsTemplateId: t.id,
      body: t.body || prev.body,
    }));
  }, []);

  const handleSend = useCallback(async () => {
    const isSms = form.channel === "sms";

    if (!form.body.trim()) {
      setToast({ type: "error", message: "Message body is required." });
      return;
    }
    if (!isSms && !form.subject.trim()) {
      setToast({ type: "error", message: "Subject is required for email." });
      return;
    }
    if (isSms && form.body.length > SMS_MULTI * SMS_MAX_PARTS) {
      setToast({
        type: "error",
        message: "SMS is too long (max 3 parts / 459 chars).",
      });
      return;
    }
    if (
      (form.audience.type === "single_teacher" ||
        form.audience.type === "single_parent") &&
      !form.audience.individual
    ) {
      setToast({ type: "error", message: "Please select a recipient." });
      return;
    }
    if (form.audience.type === "grade_parents" && !form.audience.grade) {
      setToast({ type: "error", message: "Please select a grade." });
      return;
    }

    setSending(true);

    const payload: SendEmailRequest = {
      channel: form.channel,
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
            : `${isSms ? "SMS" : "Email"} sent to ${data.recipientCount} recipient${data.recipientCount !== 1 ? "s" : ""}.`,
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
  const isSms = form.channel === "sms";
  const smsLen = form.body.length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
      {/* ── LEFT: Composer ── */}
      <div className="space-y-4">
        {/* Channel toggle */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/35">
              Send via
            </p>
            <ChannelToggle
              value={form.channel}
              onChange={handleChannelChange}
            />
          </div>
          {isSms && (
            <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.05] px-3.5 py-2.5">
              <p className="text-[11px] text-sky-400/80 leading-relaxed">
                <span className="font-bold">SMS mode:</span> Messages sent via
                Africa's Talking to recipients' registered phone numbers. No
                subject line or attachments. Max 3 SMS parts (459 chars).
              </p>
            </div>
          )}
        </div>

        {/* Audience */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 space-y-4">
          <AudienceSelector
            value={form.audience}
            teachers={recipients.teachers}
            parents={recipients.parents}
            grades={grades}
            onChange={(audience) => update("audience", audience)}
          />
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                isSms
                  ? "bg-sky-400/10 border-sky-400/20"
                  : "bg-amber-400/10 border-amber-400/20"
              }`}
            >
              <Users
                className={`h-3 w-3 ${isSms ? "text-sky-400" : "text-amber-400"}`}
              />
              <span
                className={`text-xs font-semibold ${isSms ? "text-sky-400" : "text-amber-400"}`}
              >
                {count}
              </span>
            </div>
            {isSms && (
              <span className="text-[10px] text-white/20">
                Only recipients with a phone number will receive the SMS
              </span>
            )}
          </div>
        </div>

        {/* Template picker — email or SMS */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          {isSms ? (
            <SmsTemplateSelector
              audienceType={form.audience.type}
              activeId={form.smsTemplateId}
              onSelect={applySmsTemplate}
            />
          ) : (
            <TemplateSelector
              audienceType={form.audience.type}
              activeId={form.templateId}
              onSelect={applyTemplate}
            />
          )}
        </div>

        {/* Message */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 space-y-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-white/35">
            Message
          </label>

          {!isSms && (
            <input
              type="text"
              placeholder="Subject line…"
              value={form.subject}
              onChange={(e) => update("subject", e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/35 focus:bg-white/[0.07] transition-all font-medium"
            />
          )}

          <div className="relative">
            <textarea
              placeholder={
                isSms
                  ? "Write your SMS message… (160 chars = 1 SMS)"
                  : "Write your message here…"
              }
              value={form.body}
              onChange={(e) => update("body", e.target.value)}
              rows={isSms ? 6 : 12}
              className={`w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white/80 placeholder-white/15 outline-none transition-all resize-none leading-relaxed ${
                isSms && smsLen > SMS_MULTI * SMS_MAX_PARTS
                  ? "border-rose-400/40 focus:border-rose-400/60"
                  : "border-white/[0.08] focus:border-amber-400/35 focus:bg-white/[0.07]"
              }`}
            />
          </div>

          {isSms && <SmsCounter length={smsLen} />}

          {!isSms && (
            <AttachmentUploader
              attachments={form.attachments}
              onChange={(a) => update("attachments", a)}
            />
          )}
        </div>

        {/* Schedule + send */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 space-y-4">
          <button
            type="button"
            onClick={() => setShowSchedule((s) => !s)}
            className="flex items-center gap-2 text-xs font-semibold text-white/35 hover:text-white/65 transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            {showSchedule ? "Send immediately instead" : "Schedule for later"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showSchedule ? "rotate-180" : ""}`}
            />
          </button>

          {showSchedule && (
            <div className="space-y-2">
              <label className="text-xs text-white/25 font-medium">
                Send at
              </label>
              <input
                aria-label="scheduled at"
                type="datetime-local"
                value={form.scheduledAt ?? ""}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => update("scheduledAt", e.target.value || null)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white/60 outline-none focus:border-amber-400/35 transition-all"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending}
            className={`w-full flex items-center justify-center gap-2 rounded-xl active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all px-6 py-3 text-sm font-bold shadow-lg ${
              isSms
                ? "bg-sky-500 hover:bg-sky-400 text-white shadow-sky-500/20"
                : "bg-amber-400 hover:bg-amber-300 text-[#0c0f1a] shadow-amber-400/20"
            }`}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending
              ? "Sending…"
              : form.scheduledAt
                ? `Schedule ${isSms ? "SMS" : "Email"}`
                : `Send ${isSms ? "SMS" : "Email"} to ${count}`}
          </button>
        </div>
      </div>

      {/* ── RIGHT: History / Preview ── */}
      <div className="space-y-4">
        <div className="flex rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
          {(["history", "preview"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-all ${
                activeTab === tab
                  ? "bg-white/[0.08] text-white"
                  : "text-white/25 hover:text-white/55"
              }`}
            >
              {tab === "history" ? "Sent History" : "Preview"}
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
  const isSms = form.channel === "sms";

  if (!form.body && !form.subject) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-10 text-center">
        <p className="text-3xl mb-3">{isSms ? "💬" : "✉️"}</p>
        <p className="text-white/25 text-sm">
          Start writing to see a preview here
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
      {isSms ? (
        // SMS preview — looks like a phone bubble
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-sky-400" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400/70">
              SMS Preview
            </p>
          </div>
          <div className="bg-[#1a1a2e] rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs">
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
              {form.body || "No message yet"}
            </p>
          </div>
          <p className="text-[10px] text-white/20">
            To: {AUDIENCE_LABELS[form.audience.type]}
            {form.audience.individual
              ? ` — ${form.audience.individual.full_name}`
              : ""}
            {form.audience.grade ? ` — ${form.audience.grade}` : ""}
          </p>
        </div>
      ) : (
        // Email preview
        <>
          <div className="bg-amber-500/[0.08] border-b border-amber-400/[0.08] px-5 py-4">
            <p className="text-[10px] text-amber-400/55 uppercase tracking-widest font-bold">
              Kibali Academy
            </p>
            <p className="text-sm font-bold text-white mt-0.5">
              {form.subject || "No subject"}
            </p>
            <p className="text-[11px] text-white/25 mt-1">
              To: {AUDIENCE_LABELS[form.audience.type]}
              {form.audience.individual
                ? ` — ${form.audience.individual.full_name}`
                : ""}
              {form.audience.grade ? ` — ${form.audience.grade}` : ""}
            </p>
          </div>
          <div className="p-5">
            <pre className="text-sm text-white/55 leading-relaxed whitespace-pre-wrap font-sans">
              {form.body || "No body yet"}
            </pre>
            {form.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/[0.05]">
                <p className="text-[10px] text-white/20 uppercase tracking-wider mb-2">
                  Attachments
                </p>
                {form.attachments.map((a) => (
                  <div
                    key={a.name}
                    className="flex items-center gap-2 text-xs text-white/35"
                  >
                    <Paperclip className="h-3 w-3" />
                    {a.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
