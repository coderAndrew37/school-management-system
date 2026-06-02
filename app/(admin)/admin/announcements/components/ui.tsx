// components/ui.tsx — reusable presentational primitives for the engagement feature

import { Check, Loader2, Trash2, X } from "lucide-react";
import type { Toast } from "../hooks/useEngagementToast";

// ── Delete confirm modal ──────────────────────────────────────────────────────

interface DeleteModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

export function DeleteModal({ onConfirm, onCancel, isPending }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.09] bg-[#0f1223] p-6 shadow-2xl">
        <h3 className="text-sm font-bold text-white mb-1">Remove this item?</h3>
        <p className="text-xs text-white/40 mb-5 leading-relaxed">
          It will disappear from the parent portal immediately. This cannot be
          undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-white/40 hover:text-white/70 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-500/20 border border-rose-500/30 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition-all disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-white/[0.06]" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">
        {label}
      </p>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

interface EmptyProps {
  emoji: string;
  title: string;
  sub: string;
}

export function Empty({ emoji, title, sub }: EmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-white/[0.07] text-center">
      <p className="text-4xl mb-3">{emoji}</p>
      <p className="text-white/50 font-semibold text-sm">{title}</p>
      <p className="text-white/25 text-xs mt-1 max-w-xs">{sub}</p>
    </div>
  );
}

// ── Toast banner ──────────────────────────────────────────────────────────────

interface ToastBannerProps {
  toast: Toast;
  onDismiss: () => void;
}

export function ToastBanner({ toast, onDismiss }: ToastBannerProps) {
  return (
    <div
      onClick={onDismiss}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl cursor-pointer border ${
        toast.ok
          ? "bg-emerald-400/15 border-emerald-400/30 text-emerald-400"
          : "bg-rose-400/15 border-rose-400/30 text-rose-400"
      }`}
    >
      {toast.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      {toast.msg}
    </div>
  );
}