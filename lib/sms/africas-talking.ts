// lib/sms/africastalking.ts
// Wraps the centralised AT client (lib/sms/at-client.ts) with:
//   - Kenyan phone normalisation
//   - Typed result shapes
//   - Bulk send with batching
//   - SMS template helpers

import { sendSMS } from "../at-client";

// ── Phone normalisation ───────────────────────────────────────────────────────

export function normaliseKenyanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+254") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("254") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10)
    return `+254${digits.slice(1)}`;
  if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1")))
    return `+254${digits}`;

  throw new Error(
    `Cannot normalise phone number: "${raw}". ` +
      `Expected Kenyan format e.g. 0712345678 or +254712345678.`,
  );
}

// ── Result shapes ─────────────────────────────────────────────────────────────

export interface SmsResult {
  success: boolean;
  messageId: string | null;
  cost: string | null;
  status: string;
  error?: string;
}

export interface BulkSmsResult {
  sent: number;
  failed: number;
  results: SmsResult[];
}

// ── Single SMS ────────────────────────────────────────────────────────────────

export async function sendSms(to: string, message: string): Promise<SmsResult> {
  let phone: string;
  try {
    phone = normaliseKenyanPhone(to);
  } catch (err: any) {
    return {
      success: false,
      messageId: null,
      cost: null,
      status: "invalid_phone",
      error: err.message,
    };
  }

  try {
    const response = await sendSMS(phone, message);
    const recipient = response.SMSMessageData?.Recipients?.[0];

    if (!recipient)
      return {
        success: false,
        messageId: null,
        cost: null,
        status: "no_recipient",
        error: "No recipients in AT response",
      };

    const ok = [100, 101, 102].includes(recipient.statusCode);
    return {
      success: ok,
      messageId: recipient.messageId,
      cost: recipient.cost,
      status: recipient.status,
      error: ok
        ? undefined
        : `AT: ${recipient.status} (${recipient.statusCode})`,
    };
  } catch (err: any) {
    console.error("[AT] sendSms error:", err.message);
    return {
      success: false,
      messageId: null,
      cost: null,
      status: "error",
      error: err.message,
    };
  }
}

// ── Bulk SMS ──────────────────────────────────────────────────────────────────
// AT supports up to 1000 recipients per request — batch accordingly.

const AT_BATCH_SIZE = 1000;

export async function sendBulkSms(
  recipients: { phone: string; name?: string }[],
  message: string,
): Promise<BulkSmsResult> {
  // Normalise all numbers, skip invalid ones
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const r of recipients) {
    try {
      valid.push(normaliseKenyanPhone(r.phone));
    } catch {
      invalid.push(r.phone);
    }
  }

  if (invalid.length > 0)
    console.warn(
      `[AT] ${invalid.length} invalid numbers skipped:`,
      invalid.slice(0, 5),
    );

  if (valid.length === 0)
    return { sent: 0, failed: recipients.length, results: [] };

  const results: SmsResult[] = [];
  let sent = 0,
    failed = invalid.length;

  for (let i = 0; i < valid.length; i += AT_BATCH_SIZE) {
    const batch = valid.slice(i, i + AT_BATCH_SIZE);

    try {
      // sendSMS from at-client accepts string | string[]
      const response = await sendSMS(batch, message);
      const atRecipients = response.SMSMessageData?.Recipients ?? [];

      for (const r of atRecipients) {
        const ok = [100, 101, 102].includes(r.statusCode);
        if (ok) sent++;
        else failed++;
        results.push({
          success: ok,
          messageId: r.messageId,
          cost: r.cost,
          status: r.status,
          error: ok ? undefined : r.status,
        });
      }
    } catch (err: any) {
      console.error("[AT] bulk batch error:", err.message);
      failed += batch.length;
    }
  }

  return { sent, failed, results };
}

// ── SMS templates ─────────────────────────────────────────────────────────────

export function buildOtpSms(
  otp: string,
  schoolName = "Kibali Academy",
): string {
  return `${schoolName}: Your portal setup code is ${otp}. Valid for 10 minutes. Do not share this code.`;
}

export function buildResetOtpSms(
  otp: string,
  schoolName = "Kibali Academy",
): string {
  return `${schoolName}: Your password reset code is ${otp}. Valid for 10 minutes. If you did not request this, ignore this message.`;
}
