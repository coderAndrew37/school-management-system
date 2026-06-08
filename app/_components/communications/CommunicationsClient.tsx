"use client";

// app/_components/communications/CommunicationsClient.tsx

import type { CommunicationsClientProps } from "@/lib/types/communications";
import { ChevronDown, Clock, Loader2, Send, Users } from "lucide-react";
import { useState } from "react";
import { AttachmentUploader } from "./AttachmentUploader";
import { AudienceSelector } from "./AudienceSelector";
import { ChannelToggle } from "./ChannelToggle";
import { MessagePreview } from "./MessagePreview";
import { SMS_MAX_PARTS, SMS_MULTI } from "./constants";
import { SentHistory } from "./SentHistory";
import { SmsCounter } from "./SmsCounter";
import { SmsTemplateSelector, TemplateSelector } from "./TemplateSelector";
import { Toast } from "./Toast";
import { useComposeForm } from "./useComposeForm";
import { recipientCount } from "./utils";

export function CommunicationsClient({
  recipients,
  sentLog,
  grades,
}: CommunicationsClientProps) {
  const {
    form,
    update,
    sending,
    toast,
    setToast,
    showSchedule,
    setShowSchedule,
    handleChannelChange,
    applyTemplate,
    applySmsTemplate,
    handleSend,
  } = useComposeForm();

  const [activeTab, setActiveTab] = useState<"preview" | "history">("history");

  const isSms = form.channel === "sms";
  const count = recipientCount(
    form.audience,
    recipients.teachers,
    recipients.parents,
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">
      {/* ── LEFT: Composer ── */}
      <div className="space-y-4">

        {/* Channel */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/35">
              Send via
            </p>
            <ChannelToggle value={form.channel} onChange={handleChannelChange} />
          </div>
          {isSms && (
            <div className="rounded-xl border border-sky-400/15 bg-sky-400/[0.05] px-3.5 py-2.5">
              <p className="text-[11px] text-sky-400/80 leading-relaxed">
                <span className="font-bold">SMS mode:</span> Messages sent via
                Africa&apos;s Talking to recipients&apos; registered phone numbers. No
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

        {/* Template */}
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

        {/* Message body */}
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
              isSms && form.body.length > SMS_MULTI * SMS_MAX_PARTS
                ? "border-rose-400/40 focus:border-rose-400/60"
                : "border-white/[0.08] focus:border-amber-400/35 focus:bg-white/[0.07]"
            }`}
          />

          {isSms && <SmsCounter length={form.body.length} />}

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