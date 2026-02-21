"use client";

import { resendInviteAction } from "@/lib/actions/admit";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function ResendInviteButton({
  parentId,
  parentEmail,
}: {
  parentId: string;
  parentEmail: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);

    // Using a promise toast for better interactivity
    const promise = resendInviteAction(parentId);

    toast.promise(promise, {
      loading: `Generating new link for ${parentEmail}...`,
      success: (data) => {
        if (!data.success) throw new Error(data.message);
        return `Invite sent successfully to ${parentEmail}`;
      },
      error: (err) => err.message || "Failed to resend invite",
      finally: () => setLoading(false),
    });
  };

  return (
    <button
      onClick={handleResend}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-amber-600 disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Send className="h-3.5 w-3.5" />
      )}
      Resend Access
    </button>
  );
}
