"use client";

// app/admin/parents/_components/ParentAtoms.tsx
// Small reusable primitives shared across parent management components.

import { AlertCircle, Check } from "lucide-react";
import { gradient, initials } from "./parent-utils";

// ── Toast ─────────────────────────────────────────────────────────────────────

export function Toast({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      onClick={onDismiss}
      className={[
        "fixed bottom-6 right-6 z-[70] flex items-center gap-3 rounded-xl px-4 py-3",
        "text-sm font-semibold shadow-2xl cursor-pointer select-none",
        type === "success"
          ? "bg-emerald-400/15 border border-emerald-400/30 text-emerald-400"
          : "bg-rose-400/15 border border-rose-400/30 text-rose-400",
      ].join(" ")}
    >
      {type === "success" ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  );
}

// ── Parent avatar (initials-based, colour-hashed) ─────────────────────────────

export function ParentAvatar({
  name,
  size = "sm",
}: {
  name: string;
  size?: "sm" | "lg";
}) {
  const cls =
    size === "lg"
      ? "h-14 w-14 rounded-2xl text-lg"
      : "h-8 w-8 rounded-lg text-xs";

  return (
    <div
      aria-hidden="true"
      className={`shrink-0 bg-gradient-to-br ${gradient(name)} flex items-center justify-center font-bold text-white ${cls}`}
    >
      {initials(name)}
    </div>
  );
}
