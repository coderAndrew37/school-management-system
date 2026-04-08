import { AlertTriangle, GraduationCap } from "lucide-react";

export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-amber-400/20 bg-[#111827] p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-white">{title}</p>
            <p className="text-sm text-white/50 mt-1.5 leading-relaxed">
              {body}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
              danger
                ? "bg-rose-500 hover:bg-rose-400 text-white"
                : "bg-amber-400 hover:bg-amber-300 text-[#0c0f1a]"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
