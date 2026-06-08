// app/_components/communications/ChannelToggle.tsx

import type { SendChannel } from "@/lib/types/communications";
import { Mail, MessageSquare } from "lucide-react";

interface Props {
  value: SendChannel;
  onChange: (v: SendChannel) => void;
}

export function ChannelToggle({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl border border-white/[0.08] bg-white/[0.03] w-fit">
      {(["email", "sms"] as SendChannel[]).map((ch) => {
        const active = value === ch;
        return (
          <button
            key={ch}
            type="button"
            onClick={() => onChange(ch)}
            className={[
              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all",
              active
                ? ch === "email"
                  ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                  : "bg-sky-400/15 border border-sky-400/30 text-sky-400"
                : "text-white/35 hover:text-white/60",
            ].join(" ")}
          >
            {ch === "email" ? (
              <Mail className="h-3.5 w-3.5" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5" />
            )}
            {ch === "email" ? "Email" : "SMS"}
          </button>
        );
      })}
    </div>
  );
}