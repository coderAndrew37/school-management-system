"use client";

// app/_components/communications/useComposeForm.ts

import type {
  ComposeFormState,
  MessageTemplate,
  SendChannel,
  SendEmailRequest,
  SendEmailResponse,
  SmsTemplate,
} from "@/lib/types/communications";
import { useCallback, useState } from "react";
import { DEFAULT_FORM, SMS_MAX_PARTS, SMS_MULTI } from "./constants";

export type ToastState = { type: "success" | "error"; message: string } | null;

export function useComposeForm() {
  const [form, setForm] = useState<ComposeFormState>(DEFAULT_FORM);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  const update = useCallback(
    <K extends keyof ComposeFormState>(key: K, value: ComposeFormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleChannelChange = useCallback((ch: SendChannel) => {
    setForm((prev) => ({
      ...prev,
      channel: ch,
      attachments: ch === "sms" ? [] : prev.attachments,
    }));
  }, []);

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

  return {
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
  };
}