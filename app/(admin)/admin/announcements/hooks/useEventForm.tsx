"use client";

// hooks/useEventForm.ts
// All event-form state and the async submit action live here.

import { createEventAction } from "@/lib/actions/engagement";
import { useCallback, useState, useTransition } from "react";
import type { Audience } from "../types";

export interface EventFormState {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  audience: Audience;
  grade: string;
}

const INITIAL: EventFormState = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  audience: "all",
  grade: "All grades",
};

export function useEventForm(
  onSuccess: (msg: string) => void,
  onError: (msg: string) => void,
) {
  const [form, setForm] = useState<EventFormState>(INITIAL);
  const [isPending, startTransition] = useTransition();

  const setField = useCallback(
    <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const canSubmit = form.title.trim().length >= 2 && form.startDate.length > 0;

  const submit = useCallback(() => {
    if (!canSubmit) return;

    startTransition(async () => {
      const res = await createEventAction({
        title: form.title,
        description: form.description || null,
        start_date: form.startDate,
        end_date: form.endDate || null,
        audience: form.audience,
        target_grade: form.grade !== "All grades" ? form.grade : null,
      });

      if (res.success) {
        onSuccess("Event added to calendar.");
        setForm(INITIAL);
      } else {
        onError(res.error ?? "Failed to add event");
      }
    });
  }, [form, canSubmit, onSuccess, onError]);

  return { form, setField, isPending, canSubmit, submit };
}