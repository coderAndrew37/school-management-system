/**
 * lib/email/batchSend.ts
 *
 * Paced email dispatch for bulk-admit parent welcome emails.
 *
 * ── Why pacing matters ────────────────────────────────────────────────────
 * Resend itself handles SMTP and delivery queueing, so individual sends
 * through their API will not trigger ISP-level rate limits on our domain.
 * HOWEVER, a burst of 30–100 "New account" emails landing in inboxes within
 * seconds of each other raises TWO risks:
 *
 *   1. Resend free/starter plans: 2 req/s API rate limit. Exceeding it
 *      returns HTTP 429 and drops the email silently if you don't retry.
 *
 *   2. Receiving MTAs (Gmail, Outlook) apply their own per-sender-domain
 *      reputation scoring. A sudden spike from a young domain looks like a
 *      spam blast and can trigger bulk-folder routing for that domain for
 *      days — hurting future transactional deliverability for everyone.
 *
 * ── Strategy ─────────────────────────────────────────────────────────────
 * • Use Resend's /emails/batch endpoint for groups of ≤ 100 emails.
 *   This is a single HTTPS request, so it is efficient and avoids per-email
 *   API rate-limit concerns.
 * • Split lists > 100 into multiple batch requests separated by a small
 *   inter-batch delay (default 2 s). This keeps our send rate well under
 *   Resend's 2 req/s API limit even accounting for other concurrent API
 *   calls in the system.
 * • Expose a dryRun flag so the CI / preview environment never actually
 *   sends email.
 *
 * ── References ───────────────────────────────────────────────────────────
 * https://resend.com/docs/api-reference/emails/send-batch-emails
 * https://resend.com/docs/dashboard/domains/spam-prevention
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export interface WelcomeEmailPayload {
  to: string;
  parentName: string;
  studentName: string;
  /** The magic-link / setup URL generated for this parent */
  setupUrl: string;
  fromName?: string;
  fromAddress?: string;
}

// ── Batch size limit imposed by Resend's API ──────────────────────────────
const RESEND_BATCH_LIMIT = 100;

/** ms to wait between consecutive batch requests */
const INTER_BATCH_DELAY_MS = 2_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildEmail(p: WelcomeEmailPayload) {
  const from = `${p.fromName ?? "Kibali Academy"} <${p.fromAddress ?? "noreply@yourdomain.com"}>`;
  return {
    from,
    to: p.to,
    subject: `Welcome to Kibali Academy — set up your parent account`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#1a1a2e">
        <h2 style="color:#f59e0b">Welcome, ${p.parentName}!</h2>
        <p>
          Your child <strong>${p.studentName}</strong> has been admitted to Kibali Academy.
          Please click the button below to set up your parent portal account.
        </p>
        <a href="${p.setupUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;background:#f59e0b;color:#0c0f1a;font-weight:bold;border-radius:10px;text-decoration:none">
          Set up my account →
        </a>
        <p style="color:#666;font-size:13px">
          This link expires in 72 hours. If you did not expect this email, please ignore it.
        </p>
      </div>
    `,
  };
}

export interface BatchSendResult {
  sent: number;
  failed: { email: string; error: string }[];
}

/**
 * Send welcome emails to a list of parents, paced to avoid deliverability
 * issues and Resend API rate limits.
 *
 * @param payloads  - One entry per parent who needs an email
 * @param dryRun    - When true, logs instead of sending (use in dev/CI)
 */
export async function sendBulkWelcomeEmails(
  payloads: WelcomeEmailPayload[],
  dryRun = process.env.NODE_ENV !== "production"
): Promise<BatchSendResult> {
  const result: BatchSendResult = { sent: 0, failed: [] };

  if (payloads.length === 0) return result;

  if (dryRun) {
    console.log(
      `[batchSend] DRY RUN — would send ${payloads.length} welcome email(s):`,
      payloads.map((p) => p.to)
    );
    result.sent = payloads.length;
    return result;
  }

  // Split into chunks of RESEND_BATCH_LIMIT
  const chunks: WelcomeEmailPayload[][] = [];
  for (let i = 0; i < payloads.length; i += RESEND_BATCH_LIMIT) {
    chunks.push(payloads.slice(i, i + RESEND_BATCH_LIMIT));
  }

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];

    // Pause between batches (skip before the very first one)
    if (c > 0) await sleep(INTER_BATCH_DELAY_MS);

    try {
      const emails = chunk.map(buildEmail);
      const { data, error } = await resend.batch.send(emails);

      if (error) {
        // Entire batch failed (auth error, network, etc.)
        console.error("[batchSend] Batch error:", error);
        for (const p of chunk) {
          result.failed.push({ email: p.to, error: error.message });
        }
        continue;
      }

      // Resend batch response: array of { id } or per-item errors
      // The SDK types vary — handle both shapes defensively
      const responses = Array.isArray(data) ? data : [];
      responses.forEach((r, idx) => {
        if ((r as { error?: { message: string } }).error) {
          result.failed.push({
            email: chunk[idx]?.to ?? "unknown",
            error: (r as { error: { message: string } }).error.message,
          });
        } else {
          result.sent++;
        }
      });

      // If resend returns fewer responses than emails, count the rest as sent
      // (older SDK versions return a single { id } for the whole batch)
      if (responses.length === 0) {
        result.sent += chunk.length;
      }
    } catch (err) {
      console.error("[batchSend] Unexpected error:", err);
      for (const p of chunk) {
        result.failed.push({ email: p.to, error: String(err) });
      }
    }
  }

  if (result.failed.length > 0) {
    console.warn(
      `[batchSend] ${result.failed.length} email(s) failed:`,
      result.failed.map((f) => f.email)
    );
  }

  return result;
}