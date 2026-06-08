// app/_components/communications/MessagePreview.tsx

import type { ComposeFormState } from "@/lib/types/communications";
import { AUDIENCE_LABELS } from "@/lib/utils/communication-templates";
import { Paperclip } from "lucide-react";

interface Props {
  form: ComposeFormState;
}

export function MessagePreview({ form }: Props) {
  const isSms = form.channel === "sms";

  if (!form.body && !form.subject) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-10 text-center">
        <p className="text-3xl mb-3">{isSms ? "💬" : "✉️"}</p>
        <p className="text-white/25 text-sm">
          Start writing to see a preview here
        </p>
      </div>
    );
  }

  const audienceLine = [
    AUDIENCE_LABELS[form.audience.type],
    form.audience.individual ? `— ${form.audience.individual.full_name}` : null,
    form.audience.grade ? `— ${form.audience.grade}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (isSms) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-sky-400" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400/70">
            SMS Preview
          </p>
        </div>
        <div className="bg-[#1a1a2e] rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs">
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
            {form.body || "No message yet"}
          </p>
        </div>
        <p className="text-[10px] text-white/20">To: {audienceLine}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
      <div className="bg-amber-500/[0.08] border-b border-amber-400/[0.08] px-5 py-4">
        <p className="text-[10px] text-amber-400/55 uppercase tracking-widest font-bold">
          Kibali Academy
        </p>
        <p className="text-sm font-bold text-white mt-0.5">
          {form.subject || "No subject"}
        </p>
        <p className="text-[11px] text-white/25 mt-1">To: {audienceLine}</p>
      </div>
      <div className="p-5">
        <pre className="text-sm text-white/55 leading-relaxed whitespace-pre-wrap font-sans">
          {form.body || "No body yet"}
        </pre>
        {form.attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/[0.05]">
            <p className="text-[10px] text-white/20 uppercase tracking-wider mb-2">
              Attachments
            </p>
            {form.attachments.map((a) => (
              <div
                key={a.name}
                className="flex items-center gap-2 text-xs text-white/35"
              >
                <Paperclip className="h-3 w-3" />
                {a.name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}