"use client";

// app/(admin)/settings/_components/ui.tsx

import { Check, AlertCircle } from "lucide-react";

// ── Toast ─────────────────────────────────────────────────────────────────────

export interface ToastState {
  type: "success" | "error";
  message: string;
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  return (
    <div
      onClick={onDismiss}
      className={[
        "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl cursor-pointer transition-all",
        toast.type === "success"
          ? "bg-emerald-400/15 border border-emerald-400/30 text-emerald-400"
          : "bg-rose-400/15 border border-rose-400/30 text-rose-400",
      ].join(" ")}
    >
      {toast.type === "success" ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {toast.message}
    </div>
  );
}

// ── SectionHeading ────────────────────────────────────────────────────────────

export function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-amber-400/60">{icon}</div>
      <h3 className="text-sm font-bold text-white">{title}</h3>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────

export function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const base =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors";

  return (
    <div className={textarea ? "sm:col-span-2" : ""}>
      <label
        htmlFor={name}
        className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2"
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={2}
          className={base + " resize-none"}
        />
      ) : (
        <input
          id={name}
          type={type}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          className={base}
        />
      )}
    </div>
  );
}

// ── DateField ─────────────────────────────────────────────────────────────────

export function DateField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5"
      >
        {label}
      </label>
      <input
        id={name}
        type="date"
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 transition-colors [color-scheme:dark]"
      />
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

export function Toggle({
  label,
  description,
  enabled,
  onChange,
  color = "emerald",
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  color?: "emerald" | "sky";
}) {
  const on =
    color === "emerald"
      ? "bg-emerald-400/20 border-emerald-400/40"
      : "bg-sky-400/20 border-sky-400/40";
  const dot = color === "emerald" ? "bg-emerald-400" : "bg-sky-400";

  return (
    <div
      className={[
        "flex items-start justify-between gap-4 rounded-xl border p-4 cursor-pointer transition-all",
        enabled ? on : "border-white/[0.07] bg-white/[0.02]",
      ].join(" ")}
      onClick={() => onChange(!enabled)}
    >
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/40 mt-0.5">{description}</p>
      </div>
      <div
        className={[
          "relative w-11 h-6 rounded-full border shrink-0 transition-all mt-0.5",
          enabled ? on : "border-white/15 bg-white/[0.05]",
        ].join(" ")}
      >
        <div
          className={[
            "absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200",
            enabled ? `left-5 ${dot}` : "left-0.5 bg-white/20",
          ].join(" ")}
        />
      </div>
    </div>
  );
}