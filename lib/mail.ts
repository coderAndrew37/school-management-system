import { Resend } from "resend";
import type {
  AudienceSelection,
  SingleRecipient,
} from "@/lib/types/communications";

// ── Resend client ─────────────────────────────────────────────────────────────

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_EMAIL =
  process.env.NODE_ENV === "production"
    ? `noreply@${process.env.PROD_EMAIL ?? "kibali.ac.ke"}`
    : "onboarding@resend.dev";

const SENDER_STAFF_EMAIL =
  process.env.NODE_ENV === "production"
    ? `staff@${process.env.PROD_STAFF_EMAIL ?? "kibali.ac.ke"}`
    : "onboarding@resend.dev";

const DEV_EMAIL = process.env.DEV_EMAIL ?? "omollondrw@gmail.com";

function resolveRecipient(email: string): string {
  return process.env.NODE_ENV === "production" ? email : DEV_EMAIL;
}

// ── Branded HTML shell ────────────────────────────────────────────────────────

function buildEmail({
  previewText,
  headerBg,
  headerLabel,
  headerSubtitle,
  body,
}: {
  previewText: string;
  headerBg: string;
  headerLabel: string;
  headerSubtitle: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headerLabel}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${previewText}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <tr>
            <td style="background:${headerBg};padding:0;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:28px 32px 24px;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right:14px;vertical-align:middle;">
                          <div style="width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:12px;text-align:center;line-height:44px;font-size:22px;">
                            🎓
                          </div>
                        </td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0;font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.65);">Kibali Academy</p>
                          <p style="margin:3px 0 0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.2;">${headerLabel}</p>
                          <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.65);">${headerSubtitle}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="height:4px;background:rgba(255,255,255,0.15);"></td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 32px 28px;color:#1a202c;font-size:15px;line-height:1.7;">
              ${body}
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 32px;border-top:1px solid #edf2f7;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="text-align:center;">
                    <p style="margin:0;font-size:11px;color:#a0aec0;line-height:1.6;">
                      <strong style="color:#718096;">Kibali Academy</strong> · Nairobi, Kenya<br>
                      This message was sent from the school administration portal.<br>
                      If you did not expect this email, please ignore it.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin-top:20px;">
          <tr>
            <td style="text-align:center;padding:0 16px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">
                © ${new Date().getFullYear()} Kibali Academy. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── CTA button helper ─────────────────────────────────────────────────────────

function ctaButton(
  href: string,
  label: string,
  bg = "#f59e0b",
  textColor = "#0c0f1a",
): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:28px auto;">
      <tr>
        <td align="center" style="border-radius:10px;background:${bg};">
          <a href="${href}"
             target="_blank"
             style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:${textColor};text-decoration:none;border-radius:10px;letter-spacing:0.01em;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

// ── Info row helper ───────────────────────────────────────────────────────────

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f7fafc;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#a0aec0;width:120px;">${label}</td>
            <td style="font-size:14px;color:#2d3748;font-weight:600;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

// ── Attachment shape Resend expects ───────────────────────────────────────────

interface ResendAttachment {
  filename: string;
  content: string;
}

// ── Welcome email (parent invite) ─────────────────────────────────────────────

export interface WelcomeEmailParams {
  parentEmail: string;
  parentName: string;
  studentName: string;
  grade: string;
  setupLink: string;
}

export async function sendWelcomeEmail({
  parentEmail,
  parentName,
  studentName,
  grade,
  setupLink,
}: WelcomeEmailParams): Promise<{ success: boolean; error?: unknown }> {
  const firstName = parentName.split(" ")[0] ?? parentName;

  const body = `
    <p style="margin:0 0 16px;">Dear <strong>${parentName}</strong>,</p>

    <p style="margin:0 0 16px;color:#4a5568;">
      We are delighted to welcome <strong>${studentName}</strong> to
      <strong>Kibali Academy</strong>! Admission has been confirmed and your
      child's profile is now active in our system.
    </p>

    <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:12px;padding:20px 24px;margin:24px 0;">
      <p style="margin:0 0 12px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#92400e;">
        Student Details
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${infoRow("Student", studentName)}
        ${infoRow("Grade", grade)}
        ${infoRow("Parent email", parentEmail)}
      </table>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1a202c;">
        Set Up Your Parent Account
      </p>
      <p style="margin:0 0 4px;font-size:13px;color:#718096;line-height:1.6;">
        Use the secure button below to create your password and access<br>
        your child's results, attendance, and school communications.
      </p>
      <p style="margin:0 0 20px;font-size:12px;color:#a0aec0;">
        ⏱ This link expires in <strong>24 hours</strong>
      </p>
      ${ctaButton(setupLink, "Set Up My Account →")}
      <p style="margin:12px 0 0;font-size:11px;color:#cbd5e0;">
        Or copy this link into your browser:<br>
        <span style="color:#a0aec0;word-break:break-all;">${setupLink}</span>
      </p>
    </div>

    <p style="margin:0 0 8px;font-size:14px;color:#718096;">
      Once your account is active you can:
    </p>
    <ul style="margin:0 0 20px;padding-left:20px;color:#4a5568;font-size:14px;line-height:2;">
      <li>View ${firstName}'s CBC assessment scores and narratives</li>
      <li>Track daily attendance records</li>
      <li>Read school announcements and diary entries</li>
      <li>Message teachers directly through the school portal</li>
    </ul>

    <p style="margin:0;font-size:13px;color:#a0aec0;">
      🔒 Never share this link with anyone. It is unique to your account.
      If you did not register a child at Kibali Academy, please ignore this email.
    </p>
  `;

  try {
    const { error } = await resend.emails.send({
      from: `Kibali Academy <${SENDER_EMAIL}>`,
      to: resolveRecipient(parentEmail),
      subject: `Welcome to Kibali Academy — Set Up Your Parent Account for ${studentName}`,
      html: buildEmail({
        previewText: `${studentName} has been admitted to Kibali Academy. Set up your parent account to get started.`,
        headerBg: "#f59e0b",
        headerLabel: "Admission Confirmed",
        headerSubtitle: `${studentName} · ${grade}`,
        body,
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

// ── Teacher welcome email ─────────────────────────────────────────────────────

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
  const body = `
    <p style="margin:0 0 16px;">Dear <strong>${teacherName}</strong>,</p>

    <p style="margin:0 0 16px;color:#4a5568;">
      Welcome to the teaching staff at <strong>Kibali Academy</strong>.
      Your professional account has been set up in our school management system
      and you are ready to get started.
    </p>

    <div style="background:#ecfdf5;border:1px solid #d1fae5;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#064e3b;">Activate Your Staff Account</p>
      <p style="margin:0 0 4px;font-size:13px;color:#047857;line-height:1.6;">
        Set your password to access CBC assessments, timetables,<br>
        class diaries, and student records.
      </p>
      <p style="margin:0 0 20px;font-size:12px;color:#6ee7b7;">
        ⏱ This link expires in <strong>24 hours</strong>
      </p>
      ${ctaButton(setupLink, "Activate Staff Account →", "#10b981", "#ffffff")}
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${infoRow("Email", teacherEmail)}
        ${infoRow("Access level", "Teaching Staff")}
        ${infoRow("Portal", "teacher.kibali.ac.ke")}
      </table>
    </div>

    <p style="margin:0;font-size:13px;color:#a0aec0;">
      🔒 This link is unique to your account. Do not share it.
      Contact the school office if you have any trouble.
    </p>
  `;

  try {
    const { error } = await resend.emails.send({
      from: `Kibali Academy Staff <${SENDER_STAFF_EMAIL}>`,
      to: resolveRecipient(teacherEmail),
      subject: `Staff Onboarding: Welcome to Kibali Academy, ${teacherName}`,
      html: buildEmail({
        previewText: `Your Kibali Academy staff account is ready. Activate it to get started.`,
        headerBg: "#10b981",
        headerLabel: "Staff Account Created",
        headerSubtitle: "Kibali Academy Teacher Portal",
        body,
      }),
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("sendTeacherWelcomeEmail crash:", err);
    return { success: false, error: err };
  }
}

// ── Subject allocation email ──────────────────────────────────────────────────

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
  const body = `
    <p style="margin:0 0 16px;">Hello <strong>${teacherName}</strong>,</p>
    <p style="margin:0 0 16px;color:#4a5568;">
      You have been officially allocated the following subject for the
      <strong>2026 academic year</strong>:
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #10b981;border-radius:10px;padding:20px 24px;margin:20px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${infoRow("Subject", subjectName)}
        ${infoRow("Grade", grade)}
        ${infoRow("Academic year", "2026")}
      </table>
    </div>

    <p style="margin:0;color:#4a5568;font-size:14px;">
      Log in to the staff portal to view your updated timetable and begin
      preparing lesson strands.
    </p>
  `;

  try {
    const { error } = await resend.emails.send({
      from: `Kibali Academy <${SENDER_EMAIL}>`,
      to: resolveRecipient(teacherEmail),
      subject: `New Allocation: ${subjectName} — ${grade}`,
      html: buildEmail({
        previewText: `You've been allocated ${subjectName} for ${grade}.`,
        headerBg: "#10b981",
        headerLabel: "Subject Allocated",
        headerSubtitle: `${subjectName} · ${grade}`,
        body,
      }),
    });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error("sendAllocationEmail crash:", err);
    return { success: false, error: err };
  }
}

// ── Password reset email ──────────────────────────────────────────────────────

export interface PasswordResetEmailParams {
  recipientEmail: string;
  recipientName: string;
  resetLink: string;
  isFirstSetup?: boolean;
}

export async function sendPasswordResetEmail({
  recipientEmail,
  recipientName,
  resetLink,
  isFirstSetup = false,
}: PasswordResetEmailParams): Promise<{ success: boolean; error?: unknown }> {
  const firstName = recipientName.split(" ")[0] ?? recipientName;

  const body = isFirstSetup
    ? `
    <p style="margin:0 0 16px;">Dear <strong>${recipientName}</strong>,</p>
    <p style="margin:0 0 16px;color:#4a5568;">
      Your Kibali Academy account has been created. Use the button below to set
      your password and access the portal.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1a202c;">Set Your Password</p>
      <p style="margin:0 0 20px;font-size:12px;color:#a0aec0;">⏱ This link expires in <strong>24 hours</strong></p>
      ${ctaButton(resetLink, "Set My Password →")}
      <p style="margin:12px 0 0;font-size:11px;color:#cbd5e0;word-break:break-all;">${resetLink}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#a0aec0;">
      🔒 Never share this link. It is unique to your account.
      If you did not request this, please ignore it or contact the school office.
    </p>`
    : `
    <p style="margin:0 0 16px;">Hello <strong>${firstName}</strong>,</p>
    <p style="margin:0 0 16px;color:#4a5568;">
      We received a request to reset the password for your Kibali Academy account.
      Click the button below to choose a new password.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:16px;font-weight:700;color:#1a202c;">Reset Your Password</p>
      <p style="margin:0 0 20px;font-size:12px;color:#a0aec0;">⏱ This link expires in <strong>1 hour</strong></p>
      ${ctaButton(resetLink, "Reset My Password →")}
      <p style="margin:12px 0 0;font-size:11px;color:#cbd5e0;word-break:break-all;">${resetLink}</p>
    </div>
    <div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:10px;padding:14px 18px;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#92400e;">
        🔒 <strong>Didn't request this?</strong> Your account is safe —
        simply ignore this email. No changes will be made.
      </p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin:0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#a0aec0;">Need help?</p>
      <p style="margin:0;font-size:13px;color:#718096;line-height:1.6;">
        Visit the school office and a staff member can reset your account in person.
        No email required.
      </p>
    </div>`;

  try {
    const { error } = await resend.emails.send({
      from: `Kibali Academy <${SENDER_EMAIL}>`,
      to: resolveRecipient(recipientEmail),
      subject: isFirstSetup
        ? "Set Up Your Kibali Academy Account"
        : "Reset Your Kibali Academy Password",
      html: buildEmail({
        previewText: isFirstSetup
          ? "Your Kibali Academy account is ready — set your password to get started."
          : `Hi ${firstName}, here is your password reset link for Kibali Academy.`,
        headerBg: "#f59e0b",
        headerLabel: isFirstSetup ? "Account Setup" : "Password Reset",
        headerSubtitle: "Kibali Academy · School Portal",
        body,
      }),
    });

    if (error) {
      console.error("sendPasswordResetEmail error:", error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.error("sendPasswordResetEmail crash:", err);
    return { success: false, error: err };
  }
}

// ── Broadcast engine ──────────────────────────────────────────────────────────

export interface BroadcastEmailParams {
  recipients: SingleRecipient[];
  subject: string;
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

const BATCH_SIZE = 100;

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

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);

    const batchPayload = chunk.map((recipient) => {
      const bodyHtml = `
        <p style="margin:0 0 8px;font-size:14px;color:#718096;">
          Dear <strong style="color:#2d3748;">${recipient.full_name}</strong>,
        </p>
        <div style="white-space:pre-wrap;line-height:1.8;font-size:15px;color:#2d3748;margin-top:16px;">
          ${body}
        </div>`;

      return {
        from: `Kibali Academy <${SENDER_EMAIL}>`,
        to: resolveRecipient(recipient.email),
        subject,
        html: buildEmail({
          previewText: subject,
          headerBg: "#0c0f1a",
          headerLabel: senderLabel,
          headerSubtitle: "Kibali Academy School Communication",
          body: bodyHtml,
        }),
        ...(resendAttachments.length > 0 && { attachments: resendAttachments }),
      };
    });

    try {
      const { data, error } = await resend.batch.send(batchPayload);

      if (error) {
        console.error("broadcastEmail batch error:", error);
        chunk.forEach((r) =>
          failures.push({ email: r.email, error: JSON.stringify(error) }),
        );
      } else if (data) {
        data.data.forEach((item) => {
          if (item.id) messageIds.push(item.id);
        });
      } else {
        chunk.forEach((r) =>
          failures.push({
            email: r.email,
            error: "No data and no error returned from Resend",
          }),
        );
      }
    } catch (err) {
      console.error("broadcastEmail batch threw:", err);
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

import { createSupabaseServerClient } from "@/lib/supabase/server";

type RecipientRow = { id: string; full_name: string; email: string };

export async function resolveAudienceRecipients(
  audience: AudienceSelection,
): Promise<SingleRecipient[]> {
  const supabase = await createSupabaseServerClient();

  switch (audience.type) {
    case "single_teacher":
    case "single_parent": {
      if (audience.individual === null) return [];
      return [audience.individual];
    }

    case "all_teachers": {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, full_name, email,phone_number")
        .returns<RecipientRow[]>();
      if (error) {
        console.error("resolveAudienceRecipients teachers error:", error);
        return [];
      }
      return data ?? [];
    }

    case "all_parents": {
      const { data, error } = await supabase
        .from("parents")
        .select("id, full_name, email, phone_number")
        .returns<RecipientRow[]>();
      if (error) {
        console.error("resolveAudienceRecipients parents error:", error);
        return [];
      }
      return data ?? [];
    }

    case "grade_parents": {
      if (audience.grade === null) return [];

      const { data, error } = await supabase
        .from("student_parents")
        .select(
          `
          parents ( id, full_name, email, phone_number ),
          students!inner ( current_grade )
        `,
        )
        .eq("students.current_grade", audience.grade)
        .returns<
          { parents: RecipientRow; students: { current_grade: string } }[]
        >();

      if (error) {
        console.error("resolveAudienceRecipients grade_parents error:", error);
        return [];
      }

      const seen = new Set<string>();
      return (data ?? [])
        .map((row) => row.parents)
        .filter((p) => {
          if (!p || seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
    }

    case "all_staff_and_parents": {
      const [teachersRes, parentsRes] = await Promise.all([
        supabase
          .from("teachers")
          .select("id, full_name, email, phone_number")
          .returns<RecipientRow[]>(),
        supabase
          .from("parents")
          .select("id, full_name, email, phone_number")
          .returns<RecipientRow[]>(),
      ]);

      if (teachersRes.error)
        console.error(
          "resolveAudienceRecipients teachers error:",
          teachersRes.error,
        );
      if (parentsRes.error)
        console.error(
          "resolveAudienceRecipients parents error:",
          parentsRes.error,
        );

      return [...(teachersRes.data ?? []), ...(parentsRes.data ?? [])];
    }
  }
}
