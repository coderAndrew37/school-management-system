"use client";

// hooks/useAnnouncementForm.ts
// All announcement-form state and the async submit action live here.
// The component layer just binds values and calls the returned handlers.

import { createAnnouncementAction } from "@/lib/actions/engagement";
import { useCallback, useState, useTransition } from "react";
import type { Audience } from "../types";

export interface AnnouncementFormState {
  title: string;
  body: string;
  priority: "normal" | "urgent";
  audience: Audience;
  grade: string;
  expiresAt: string;
}

const INITIAL: AnnouncementFormState = {
  title: "",
  body: "",
  priority: "normal",
  audience: "all",
  grade: "All grades",
  expiresAt: "",
};

export function useAnnouncementForm(
  onSuccess: (msg: string) => void,
  onError: (msg: string) => void,
) {
  const [form, setForm] = useState<AnnouncementFormState>(INITIAL);
  const [isPending, startTransition] = useTransition();

  const setField = useCallback(
    <K extends keyof AnnouncementFormState>(
      key: K,
      value: AnnouncementFormState[K],
    ) => setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const canSubmit =
    form.title.trim().length >= 2 && form.body.trim().length >= 5;

  const submit = useCallback(() => {
    if (!canSubmit) return;

    startTransition(async () => {
      const res = await createAnnouncementAction({
        title: form.title,
        body: form.body,
        priority: form.priority,
        audience: form.audience,
        target_grade: form.grade !== "All grades" ? form.grade : null,
        expires_at: form.expiresAt || null,
      });

      if (res.success) {
        onSuccess("Notice published — parents will see it now.");
        setForm(INITIAL);
      } else {
        onError(res.error ?? "Failed to publish");
      }
    });
  }, [form, canSubmit, onSuccess, onError]);

  return { form, setField, isPending, canSubmit, submit };
}