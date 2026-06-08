// app/_components/communications/TemplateSelector.tsx

import type {
  AudienceType,
  MessageTemplate,
  SmsTemplate,
  SmsTemplateId,
  TemplateId,
} from "@/lib/types/communications";
import {
  getTemplatesForAudience,
  getSmsTemplatesForAudience,
} from "@/lib/utils/communication-templates";

// ── Email template picker ─────────────────────────────────────────────────────

interface TemplateSelectorProps {
  audienceType: AudienceType;
  activeId: TemplateId;
  onSelect: (t: MessageTemplate) => void;
}

export function TemplateSelector({
  audienceType,
  activeId,
  onSelect,
}: TemplateSelectorProps) {
  const templates = getTemplatesForAudience(audienceType);
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-white/35">
        Template
      </label>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t)}
            className={[
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
              activeId === t.id
                ? "bg-amber-400/15 border-amber-400/35 text-amber-400"
                : "bg-white/[0.02] border-white/[0.06] text-white/35 hover:text-white/65 hover:border-white/[0.12]",
            ].join(" ")}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── SMS template picker ───────────────────────────────────────────────────────

interface SmsTemplateSelectorProps {
  audienceType: AudienceType;
  activeId: SmsTemplateId;
  onSelect: (t: SmsTemplate) => void;
}

export function SmsTemplateSelector({
  audienceType,
  activeId,
  onSelect,
}: SmsTemplateSelectorProps) {
  const templates = getSmsTemplatesForAudience(audienceType);
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-white/35">
        Template
      </label>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const active = activeId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t)}
              className={[
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all",
                active
                  ? "bg-sky-400/15 border-sky-400/35 text-sky-400"
                  : "bg-white/[0.02] border-white/[0.06] text-white/35 hover:text-white/65 hover:border-white/[0.12]",
              ].join(" ")}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
              {t.charHint > 0 && (
                <span
                  className={`text-[9px] font-mono ml-0.5 ${
                    active ? "text-sky-400/60" : "text-white/20"
                  }`}
                >
                  {t.charHint}c
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}