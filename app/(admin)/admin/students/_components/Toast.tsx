import { Check, AlertCircle } from "lucide-react";

export default function Toast({
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
      onClick={onDismiss}
      className={[
        "fixed bottom-6 right-6 z-[70] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl cursor-pointer",
        type === "success"
          ? "bg-emerald-400/15 border border-emerald-400/30 text-emerald-400"
          : "bg-rose-400/15 border border-rose-400/30 text-rose-400",
      ].join(" ")}
    >
      {type === "success" ? (
        <Check className="h-4 w-4" />
      ) : (
        <AlertCircle className="h-4 w-4" />
      )}
      {message}
    </div>
  );
}
