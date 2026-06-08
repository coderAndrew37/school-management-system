// app/_components/communications/Toast.tsx

import { AlertCircle, CheckCircle2, X } from "lucide-react";

export type ToastState = { type: "success" | "error"; message: string } | null;

interface Props {
  toast: ToastState;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: Props) {
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