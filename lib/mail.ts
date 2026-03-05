import { Resend } from "resend";
import type {
  AudienceSelection,
  SingleRecipient,
} from "@/lib/types/communications";

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_EMAIL =
  process.env.NODE_ENV === "production"
    ? process.env.PROD_EMAIL || "contact.sleeksites-test.co.ke"
    : "onboarding@resend.dev";

const SENDER_STAFF_EMAIL =
  process.env.NODE_ENV === "production"
    ? process.env.PROD_EMAIL || "contact.sleeksites-test.co.ke"
    : "onboarding@resend.dev";

/** In dev we only send to this verified address to satisfy Resend's sandbox */
const DEV_EMAIL = process.env.DEV_EMAIL || "omollondrw@gmail.com";

function resolveRecipient(email: string): string {
  return process.env.NODE_ENV === "production" ? email : DEV_EMAIL;
}

// ── Base HTML wrapper ─────────────────────────────────────────────────────────

function wrapHtml({
  accentColor,
  accentLabel,
  body,
}: {
  accentColor: string;
  accentLabel: string;
  body: string;
}): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #1a202c;">
      <div style="background: ${accentColor}; padding: 24px 32px;">
        <p style="margin: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.75);">Kibali Academy</p>
        <h1 style="margin: 4px 0 0; font-size: 22px; color: #fff; font-weight: 700;">${accentLabel}</h1>
      </div>
      <div style="padding: 32px;">
        ${body}
        <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 28px 0;" />
        <footer style="text-align: center; font-size: 11px; color: #a0aec0;">
          Kibali Academy · Nairobi, Kenya<br>
          This message was sent from the Kibali Academy administration portal.
        </footer>
      </div>
    </div>
  `;
}

// ── Attachment shape Resend expects ───────────────────────────────────────────

interface ResendAttachment {
  filename: string;
  content: string; // base64
}

// ── Existing transactional emails (preserved & typed) ─────────────────────────

export interface WelcomeEmailParams {
  parentEmail: string;
  parentName: string;
  studentName: string;
  setupLink: string;
}

export async function sendWelcomeEmail({
  parentEmail,
  parentName,
  studentName,
  setupLink,
}: WelcomeEmailParams): Promise<{ success: boolean; error?: unknown }> {
  try {
    const { error } = await resend.emails.send({
      from: `Kibali Academy <${SENDER_EMAIL}>`,
      to: resolveRecipient(parentEmail),
      subject: `Admission Successful: Welcome ${studentName} to Kibali Academy`,
      html: wrapHtml({
        accentColor: "#f59e0b",
        accentLabel: "Admission Confirmed",
        body: `
          <p>Dear <strong>${parentName}</strong>,</p>
          <p>We are excited to welcome <strong>${studentName}</strong> to the Kibali Academy family! Your registration has been processed successfully.</p>
          <div style="background: #fffbeb; border: 1px solid #fef3c7; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
            <p style="margin-top: 0; font-weight: 600; color: #92400e;">Secure Account Setup</p>
            <p style="font-size: 14px; color: #b45309; margin-bottom: 20px;">Set your password using the secure link below to access your parent dashboard.</p>
            <a href="${setupLink}" style="display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Set Up My Account</a>
          </div>
          <p style="font-size: 14px; color: #4a5568;"><strong>Username:</strong> ${parentEmail}<br><strong>Link Expiry:</strong> 24 hours</p>
          <p style="font-size: 13px; color: #a0aec0;">If you did not expect this email, please ignore it. Never share this link with anyone.</p>
        `,
      }),
    });

    if (error) {
      console.error("sendWelcomeEmail error:", error);
      return { success: false, error };
    }
    return { success: true };
  } catch (err) {
    console.error("sendWelcomeEmail crash:", err);
    return { success: false, error: err };
  }
}

export interface TeacherWelcomeEmailParams {
  teacherEmail: string;
  teacherName: string;
  setupLink: string;
}

export async function sendTeacherWelcomeEmail({
  teacherEmail,
  teacherName,
  setupLink,
}: TeacherWelcomeEmailParams): Promise<{ success: boolean; error?: unknown }> {
  try {
    const { error } = await resend.emails.send({
      from: `Kibali Academy Staff <${SENDER_STAFF_EMAIL}>`,
      to: resolveRecipient(teacherEmail),
      subject: `Staff Onboarding: Welcome to Kibali Academy, ${teacherName}`,
      html: wrapHtml({
        accentColor: "#10b981",
        accentLabel: "Staff Account Created",
        body: `
          <p>Dear <strong>${teacherName}</strong>,</p>
          <p>Welcome to the teaching staff at Kibali Academy. Your professional account has been set up in our school management system.</p>
          <div style="background: #ecfdf5; border: 1px solid #d1fae5; padding: 20px; border-radius: 12px; margin: 24px 0; text-align: center;">
            <p style="margin-top: 0; font-weight: 600; color: #065f46;">Portal Activation</p>
            <p style="font-size: 14px; color: #047857; margin-bottom: 20px;">Activate your account to begin recording CBC assessments and managing your timetable.</p>
            <a href="${setupLink}" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Set Up Staff Account</a>
          </div>
          <p style="font-size: 14px; color: #4a5568;"><strong>Official Email:</strong> ${teacherEmail}<br><strong>Access Level:</strong> Teaching Staff<br><strong>Link Expiry:</strong> 24 hours</p>
        `,
      }),
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("sendTeacherWelcomeEmail crash:", err);
    return { success: false, error: err };
  }
}

export interface AllocationEmailParams {
  teacherEmail: string;
  teacherName: string;
  subjectName: string;
  grade: string;
}

export async function sendAllocationEmail({
  teacherEmail,
  teacherName,
  subjectName,
  grade,
}: AllocationEmailParams): Promise<{ success: boolean; error?: unknown }> {
  try {
    const { error } = await resend.emails.send({
      from: `Kibali Academy <${SENDER_EMAIL}>`,
      to: resolveRecipient(teacherEmail),
      subject: `New Subject Allocation: ${subjectName} (${grade})`,
      html: wrapHtml({
        accentColor: "#10b981",
        accentLabel: "Subject Allocated",
        body: `
          <p>Hello <strong>${teacherName}</strong>,</p>
          <p>You have been officially allocated the following subject for the 2026 academic year:</p>
          <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <strong>Subject:</strong> ${subjectName}<br>
            <strong>Grade:</strong> ${grade}
          </div>
          <p>You can now view your updated timetable and prepare your lesson strands in the staff portal.</p>
        `,
      }),
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("sendAllocationEmail crash:", err);
    return { success: false, error: err };
  }
}

// ── Broadcast engine ──────────────────────────────────────────────────────────

export interface BroadcastEmailParams {
  recipients: SingleRecipient[];
  subject: string;
  /** Plain text or simple HTML body written by the admin */
  body: string;
  senderLabel: string;
  attachments?: Array<{ name: string; base64: string; mimeType: string }>;
}

export interface BroadcastResult {
  success: boolean;
  recipientCount: number;
  messageIds: string[];
  failures: Array<{ email: string; error: string }>;
}

/**
 * Sends an individual email to each recipient (no BCC leakage).
 * Resend's batch endpoint is used where possible (up to 100 per call).
 * Returns a summary of successes and failures.
 */
export async function broadcastEmail({
  recipients,
  subject,
  body,
  senderLabel,
  attachments = [],
}: BroadcastEmailParams): Promise<BroadcastResult> {
  const messageIds: string[] = [];
  const failures: Array<{ email: string; error: string }> = [];

  const resendAttachments: ResendAttachment[] = attachments.map((a) => ({
    filename: a.name,
    content: a.base64,
  }));

  const htmlBody = wrapHtml({
    accentColor: "#0c0f1a",
    accentLabel: senderLabel,
    body: `<div style="white-space: pre-wrap; line-height: 1.7; font-size: 15px; color: #2d3748;">${body}</div>`,
  });

  // Resend allows up to 100 emails per batch request
  const BATCH_SIZE = 100;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);

    const batchPayload = chunk.map((recipient) => ({
      from: `Kibali Academy <${SENDER_EMAIL}>`,
      to: resolveRecipient(recipient.email),
      subject,
      html: htmlBody.replace("{{name}}", recipient.full_name),
      ...(resendAttachments.length > 0 && { attachments: resendAttachments }),
    }));

    try {
      const { data, error } = await resend.batch.send(batchPayload);

      if (error) {
        // Mark all in this chunk as failed
        chunk.forEach((r) =>
          failures.push({ email: r.email, error: String(error) }),
        );
      } else if (data) {
        data.data.forEach((item) => {
          if (item.id) messageIds.push(item.id);
        });
      }
    } catch (err) {
      chunk.forEach((r) =>
        failures.push({ email: r.email, error: String(err) }),
      );
    }
  }

  return {
    success: failures.length === 0,
    recipientCount: messageIds.length,
    messageIds,
    failures,
  };
}

// ── Audience resolver ─────────────────────────────────────────────────────────
// Resolves an AudienceSelection into a concrete list of recipients.
// Called server-side in the API route so the recipient list never touches
// the client.

import { createServerClient } from "@/lib/supabase/client";

type RecipientRow = { id: string; full_name: string; email: string };

export async function resolveAudienceRecipients(
  audience: AudienceSelection,
): Promise<SingleRecipient[]> {
  const supabase = createServerClient();

  switch (audience.type) {
    case "single_teacher":
    case "single_parent": {
      if (audience.individual === null) return [];
      return [audience.individual];
    }

    case "all_teachers": {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, full_name, email")
        .returns<RecipientRow[]>();
      if (error) {
        console.error(error);
        return [];
      }
      return data ?? [];
    }

    case "all_parents": {
      const { data, error } = await supabase
        .from("parents")
        .select("id, full_name, email")
        .returns<RecipientRow[]>();
      if (error) {
        console.error(error);
        return [];
      }
      return data ?? [];
    }

    case "grade_parents": {
      if (audience.grade === null) return [];
      const { data, error } = await supabase
        .from("students")
        .select("parents!inner(id, full_name, email)")
        .eq("current_grade", audience.grade)
        .returns<{ parents: RecipientRow }[]>();
      if (error) {
        console.error(error);
        return [];
      }
      // Deduplicate by parent id (one parent may have multiple children in grade)
      const seen = new Set<string>();
      return (data ?? [])
        .map((row) => row.parents)
        .filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
    }

    case "all_staff_and_parents": {
      const [teachersRes, parentsRes] = await Promise.all([
        supabase
          .from("teachers")
          .select("id, full_name, email")
          .returns<RecipientRow[]>(),
        supabase
          .from("parents")
          .select("id, full_name, email")
          .returns<RecipientRow[]>(),
      ]);
      return [...(teachersRes.data ?? []), ...(parentsRes.data ?? [])];
    }
  }
}
