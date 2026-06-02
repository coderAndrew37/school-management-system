"use client";

// hooks/useEngagementToast.ts
// Encapsulates toast state.  The timeout is cleared on unmount so we never
// call setState on an already-unmounted component.

import { useCallback, useEffect, useRef, useState } from "react";

export interface Toast {
  msg: string;
  ok: boolean;
}

export function useEngagementToast(durationMs = 4000) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = useCallback(
    (msg: string, ok: boolean) => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      setToast({ msg, ok });
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  const dismissToast = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  return { toast, showToast, dismissToast };
}