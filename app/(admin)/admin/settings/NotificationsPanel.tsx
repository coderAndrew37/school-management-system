"use client";

// app/(admin)/settings/_components/NotificationsPanel.tsx

import { useState } from "react";
import { Bell, AlertCircle, Check, Loader2 } from "lucide-react";
import type { SchoolSettings } from "@/lib/actions/settings";
import { SectionHeading, Toggle } from "./UI";

interface NotificationsPanelProps {
  settings: SchoolSettings;
  onSave: (fd: FormData) => void;
  isPending: boolean;
}

export function NotificationsPanel({
  settings,
  onSave,
  isPending,
}: NotificationsPanelProps) {
  const [smsEnabled, setSmsEnabled] = useState(
    settings.sms_notifications_enabled,
  );
  const [emailEnabled, setEmailEnabled] = useState(
    settings.email_notifications_enabled,
  );

  function handleSubmit() {
    const fd = new FormData();

    // 1. CRITICAL: Inject the execution target layout token for permission routing
    fd.set("__form_type", "notifications");

    // 2. Clear payload requirements: Since our updated updateSchoolSettings action 
    // pulls baseline fallbacks straight from the database row, we ONLY need 
    // to append the explicit values this panel manages.
    fd.set("sms_notifications_enabled", String(smsEnabled));
    fd.set("email_notifications_enabled", String(emailEnabled));

    onSave(fd);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
        <SectionHeading
          icon={<Bell className="h-4 w-4" />}
          title="Notification Channels"
        />
        <p className="text-xs text-white/35">
          Controls whether the system sends SMS (Africa&apos;s Talking) and
          email (Resend) notifications for absence alerts and report-ready
          notices.
        </p>

        <Toggle
          label="SMS Notifications"
          description="Absence alerts and report-ready SMS sent to parents via Africa's Talking"
          enabled={smsEnabled}
          onChange={setSmsEnabled}
          color="emerald"
        />

        <Toggle
          label="Email Notifications"
          description="Welcome emails, report notifications and parent invites via Resend"
          enabled={emailEnabled}
          onChange={setEmailEnabled}
          color="sky"
        />
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-4 py-3 flex gap-3">
        <AlertCircle className="h-4 w-4 text-amber-400/70 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-400/70">
          Disabling a channel stops <strong>all</strong> outgoing messages of
          that type. Individual notification preferences per parent are not yet
          supported.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-[#0c0f1a] hover:bg-amber-300 disabled:opacity-50 transition-all"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}