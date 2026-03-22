// lib/notifications/parent-notify.ts
// Phase 3: Auto SMS + Email notifications to parents
// SMS via Africa's Talking sandbox (free dev, prod = real Kenyan numbers)
// Email via existing Resend setup

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// ── Clients ───────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_EMAIL =
  process.env.NODE_ENV === "production"
    ? (process.env.PROD_EMAIL ?? "noreply@kibali.ac.ke")
    : "onboarding@resend.dev";

const DEV_EMAIL = process.env.DEV_EMAIL ?? "omollondrw@gmail.com";

function resolveEmail(email: string): string {
  return process.env.NODE_ENV === "production" ? email : DEV_EMAIL;
}

// ── Africa's Talking SMS ──────────────────────────────────────────────────────
// Sandbox: set AT_API_KEY=sandbox, AT_USERNAME=sandbox
// Production: real credentials, real Kenyan numbers

async function sendSms(
  phoneNumber: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.AT_API_KEY ?? "sandbox";
  const username = process.env.AT_USERNAME ?? "sandbox";
  const senderId = process.env.AT_SENDER_ID ?? "KIBALI";
  const isSandbox = apiKey === "sandbox";

  const baseUrl = isSandbox
    ? "https://api.sandbox.africastalking.com/version1/messaging"
    : "https://api.africastalking.com/version1/messaging";

  // Normalise phone: Kenya numbers → +254XXXXXXXXX
  const normalised = normaliseKenyanPhone(phoneNumber);
  if (!normalised) {
    return { success: false, error: `Invalid phone number: ${phoneNumber}` };
  }

  const params = new URLSearchParams({
    username,
    to: normalised,
    message,
    from: senderId,
  });

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey,
      },
      body: params.toString(),
    });

    const json = (await res.json()) as {
      SMSMessageData?: {
        Recipients?: Array<{
          status: string;
          messageId: string;
          statusCode: number;
        }>;
      };
    };

    const recipient = json.SMSMessageData?.Recipients?.[0];
    if (recipient && recipient.statusCode === 101) {
      return { success: true, messageId: recipient.messageId };
    }

    const errMsg = recipient?.status ?? "Unknown AT error";
    return { success: false, error: errMsg };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function normaliseKenyanPhone(raw: string): string | null {
  const cleaned = raw.replace(/\s+/g, "").replace(/-/g, "");
  if (cleaned.startsWith("+254") && cleaned.length === 13) return cleaned;
  if (cleaned.startsWith("254") && cleaned.length === 12) return `+${cleaned}`;
  if (cleaned.startsWith("07") && cleaned.length === 10)
    return `+254${cleaned.slice(1)}`;
  if (cleaned.startsWith("01") && cleaned.length === 10)
    return `+254${cleaned.slice(1)}`;
  return null;
}

// ── Notification log ──────────────────────────────────────────────────────────

async function logNotification(opts: {
  studentId: string;
  parentId: string | null;
  channel: "email" | "sms" | "both";
  eventType: string;
  subject: string | null;
  body: string;
  status: "sent" | "failed";
  errorMsg?: string;
}) {
  const { error } = await supabaseAdmin.from("parent_notifications").insert({
    student_id: opts.studentId,
    parent_id: opts.parentId,
    channel: opts.channel,
    event_type: opts.eventType,
    subject: opts.subject,
    body: opts.body,
    status: opts.status,
    error_msg: opts.errorMsg ?? null,
  });
  if (error) console.error("[logNotification]", error.message);
}

// ── Shared: fetch parent contacts for a student ───────────────────────────────

interface ParentContact {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  is_primary_contact: boolean;
}

async function fetchParentContacts(
  studentId: string,
): Promise<ParentContact[]> {
  const { data, error } = await supabaseAdmin
    .from("student_parents")
    .select(
      "is_primary_contact, parents ( id, full_name, email, phone_number )",
    )
    .eq("student_id", studentId);

  if (error || !data) {
    console.error("[fetchParentContacts]", error?.message);
    return [];
  }

  type RawJoinRow = {
    is_primary_contact: boolean;
    parents: {
      id: string;
      full_name: string;
      email: string | null;
      phone_number: string | null;
    } | null;
  };
  return (data as unknown as RawJoinRow[])
    .filter(
      (
        row,
      ): row is RawJoinRow & { parents: NonNullable<RawJoinRow["parents"]> } =>
        row.parents !== null,
    )
    .map((row) => ({
      id: row.parents.id,
      full_name: row.parents.full_name,
      email: row.parents.email,
      phone_number: row.parents.phone_number,
      is_primary_contact: row.is_primary_contact,
    }));
}

// ── EVENT: Student marked absent ──────────────────────────────────────────────

export interface AbsenceNotifyParams {
  studentId: string;
  studentName: string;
  grade: string;
  date: string; // YYYY-MM-DD
}

export async function notifyAbsence(params: AbsenceNotifyParams) {
  const { studentId, studentName, grade, date } = params;

  const parents = await fetchParentContacts(studentId);
  if (parents.length === 0) {
    console.warn(`[notifyAbsence] No parents found for student ${studentId}`);
    return;
  }

  const displayDate = new Date(date).toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const firstName = studentName.split(" ")[0];

  for (const parent of parents) {
    const smsBody =
      `Kibali Academy: ${firstName} (${grade}) was marked ABSENT on ${displayDate}. ` +
      `If this is an error, please contact the school office. – Kibali Admin`;

    const emailSubject = `Absence Alert: ${studentName} — ${displayDate}`;
    const emailBody = buildAbsenceEmail({
      parentName: parent.full_name,
      studentName,
      grade,
      displayDate,
    });

    // SMS
    let smsStatus: "sent" | "failed" = "failed";
    if (parent.phone_number) {
      const smsResult = await sendSms(parent.phone_number, smsBody);
      smsStatus = smsResult.success ? "sent" : "failed";
    }

    // Email
    let emailStatus: "sent" | "failed" = "failed";
    if (parent.email) {
      try {
        const { data, error } = await resend.emails.send({
          from: `Kibali Academy <${SENDER_EMAIL}>`,
          to: resolveEmail(parent.email),
          subject: emailSubject,
          html: emailBody,
        });
        emailStatus = error ? "failed" : "sent";
      } catch (err) {
        emailStatus = "failed";
        console.error("[notifyAbsence email]", String(err));
      }
    }

    const channel: "email" | "sms" | "both" =
      parent.email && parent.phone_number
        ? "both"
        : parent.email
          ? "email"
          : "sms";

    const overallStatus: "sent" | "failed" =
      (parent.email && emailStatus === "sent") ||
      (parent.phone_number && smsStatus === "sent")
        ? "sent"
        : "failed";

    await logNotification({
      studentId,
      parentId: parent.id,
      channel,
      eventType: "absent",
      subject: emailSubject,
      body: smsBody,
      status: overallStatus,
    });
  }
}

// ── EVENT: Report card published ──────────────────────────────────────────────

export interface ReportReadyNotifyParams {
  studentId: string;
  studentName: string;
  grade: string;
  term: number;
  academicYear: number;
}

export async function notifyReportReady(params: ReportReadyNotifyParams) {
  const { studentId, studentName, grade, term, academicYear } = params;

  const parents = await fetchParentContacts(studentId);
  if (parents.length === 0) return;

  const portalUrl = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/parent/academics`
    : "https://kibali.ac.ke/parent/academics";

  const firstName = studentName.split(" ")[0];

  const smsBody =
    `Kibali Academy: ${firstName}'s Term ${term} ${academicYear} report card is ready. ` +
    `Login to the parent portal to view it: ${portalUrl}`;

  for (const parent of parents) {
    const emailSubject = `${studentName}'s Term ${term} Report Card is Ready`;
    const emailBody = buildReportReadyEmail({
      parentName: parent.full_name,
      studentName,
      grade,
      term,
      academicYear,
      portalUrl,
    });

    let emailStatus: "sent" | "failed" = "failed";
    if (parent.email) {
      try {
        const { data, error } = await resend.emails.send({
          from: `Kibali Academy <${SENDER_EMAIL}>`,
          to: resolveEmail(parent.email),
          subject: emailSubject,
          html: emailBody,
        });
        emailStatus = error ? "failed" : "sent";
      } catch (err) {
        emailStatus = "failed";
        console.error("[notifyAbsence email]", String(err));
      }
    }

    let smsStatus: "sent" | "failed" = "failed";
    if (parent.phone_number) {
      const smsResult = await sendSms(parent.phone_number, smsBody);
      smsStatus = smsResult.success ? "sent" : "failed";
    }

    const channel: "email" | "sms" | "both" =
      parent.email && parent.phone_number
        ? "both"
        : parent.email
          ? "email"
          : "sms";

    const overallStatus: "sent" | "failed" =
      (parent.email && emailStatus === "sent") ||
      (parent.phone_number && smsStatus === "sent")
        ? "sent"
        : "failed";

    await logNotification({
      studentId,
      parentId: parent.id,
      channel,
      eventType: "report_ready",
      subject: emailSubject,
      body: smsBody,
      status: overallStatus,
    });
  }
}

// ── HTML email builders ───────────────────────────────────────────────────────

function buildAbsenceEmail(p: {
  parentName: string;
  studentName: string;
  grade: string;
  displayDate: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:#ef4444;padding:28px 32px 24px;">
          <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.65);">Kibali Academy</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#fff;">Absence Alert</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">${p.studentName} · ${p.grade}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;color:#1a202c;font-size:15px;line-height:1.7;">
          <p style="margin:0 0 16px;">Dear <strong>${p.parentName}</strong>,</p>
          <p style="margin:0 0 20px;color:#4a5568;">
            This is to inform you that <strong>${p.studentName}</strong> was marked
            <strong style="color:#ef4444;">absent</strong> from school on:
          </p>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:10px;padding:16px 20px;margin:0 0 20px;">
            <p style="margin:0;font-size:18px;font-weight:700;color:#b91c1c;">${p.displayDate}</p>
          </div>
          <p style="margin:0 0 16px;color:#4a5568;">
            If your child was absent with your knowledge, no action is required.
            If this is unexpected, please contact the school office immediately.
          </p>
          <p style="margin:0;color:#4a5568;">You can also view attendance history in the parent portal.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 32px;border-top:1px solid #edf2f7;text-align:center;">
          <p style="margin:0;font-size:11px;color:#a0aec0;">Kibali Academy · Nairobi, Kenya · This is an automated notification.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildReportReadyEmail(p: {
  parentName: string;
  studentName: string;
  grade: string;
  term: number;
  academicYear: number;
  portalUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
      <tr>
        <td style="background:#10b981;padding:28px 32px 24px;">
          <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.65);">Kibali Academy</p>
          <p style="margin:4px 0 0;font-size:22px;font-weight:800;color:#fff;">Report Card Ready</p>
          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.7);">${p.studentName} · Term ${p.term} ${p.academicYear}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;color:#1a202c;font-size:15px;line-height:1.7;">
          <p style="margin:0 0 16px;">Dear <strong>${p.parentName}</strong>,</p>
          <p style="margin:0 0 20px;color:#4a5568;">
            <strong>${p.studentName}</strong>'s <strong>Term ${p.term} ${p.academicYear}</strong>
            report card has been published and is now available to view on the Kibali Academy parent portal.
          </p>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin:0 0 24px;text-align:center;">
            <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#064e3b;">${p.studentName}</p>
            <p style="margin:0;font-size:13px;color:#047857;">${p.grade} · Term ${p.term} · ${p.academicYear}</p>
          </div>
          <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
            <tr>
              <td style="background:#10b981;border-radius:10px;">
                <a href="${p.portalUrl}" target="_blank"
                   style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;">
                  View Report Card →
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:0;font-size:13px;color:#a0aec0;text-align:center;">
            Or visit: <span style="color:#718096;">${p.portalUrl}</span>
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 32px;border-top:1px solid #edf2f7;text-align:center;">
          <p style="margin:0;font-size:11px;color:#a0aec0;">Kibali Academy · Nairobi, Kenya · This is an automated notification.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
