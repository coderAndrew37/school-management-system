// app/api/communications/send/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  SendEmailRequest,
  SendEmailResponse,
  AudienceType,
} from "@/lib/types/communications";
import { resolveAudienceRecipients, broadcastEmail } from "@/lib/mail";
import { sendBulkSms } from "@/lib/sms/africas-talking";

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildAudienceLabel(req: SendEmailRequest): string {
  const { audience } = req;
  switch (audience.type) {
    case "single_teacher":
    case "single_parent":
      return audience.individual?.full_name ?? "Unknown";
    case "all_teachers":
      return "All Teachers";
    case "all_parents":
      return "All Parents";
    case "grade_parents":
      return `Parents of ${audience.grade ?? "Unknown Grade"}`;
    case "all_staff_and_parents":
      return "All Staff & Parents";
  }
}

function buildSenderLabel(audienceType: AudienceType): string {
  switch (audienceType) {
    case "single_teacher":
    case "all_teachers":
    case "all_staff_and_parents":
      return "Message from Administration";
    default:
      return "Message from Kibali Academy";
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
): Promise<NextResponse<SendEmailResponse>> {
  const supabase = await createSupabaseServerClient();

  // Auth guard
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user)
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "Unauthorised",
      },
      { status: 401 },
    );

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (!["admin", "superadmin"].includes(profileData?.role ?? ""))
    return NextResponse.json(
      { success: false, recipientCount: 0, messageIds: [], error: "Forbidden" },
      { status: 403 },
    );

  let payload: SendEmailRequest;
  try {
    payload = (await req.json()) as SendEmailRequest;
  } catch {
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "Invalid request body",
      },
      { status: 400 },
    );
  }

  const {
    channel = "email",
    audience,
    subject,
    body,
    attachments,
    scheduledAt,
  } = payload;

  if (!body.trim())
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "Message body is required",
      },
      { status: 400 },
    );

  if (channel === "email" && !subject.trim())
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "Subject is required for email",
      },
      { status: 400 },
    );

  // SMS body limit
  if (channel === "sms" && body.length > 459)
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "SMS message too long (max 459 chars / 3 parts)",
      },
      { status: 400 },
    );

  const recipients = await resolveAudienceRecipients(audience);

  if (recipients.length === 0)
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "No recipients found for this audience",
      },
      { status: 400 },
    );

  const audienceLabel = buildAudienceLabel(payload);
  const senderLabel = buildSenderLabel(audience.type);

  // ── Scheduled ────────────────────────────────────────────────────────────────
  if (scheduledAt) {
    await supabase.from("communications_log").insert({
      sent_by: user.id,
      audience_type: audience.type,
      audience_label: audienceLabel,
      channel,
      subject: channel === "sms" ? "(SMS)" : subject,
      body_preview: body.slice(0, 120).replace(/\n/g, " "),
      recipient_count: recipients.length,
      status: "scheduled",
      scheduled_at: scheduledAt,
      sent_at: null,
    });
    return NextResponse.json({
      success: true,
      recipientCount: recipients.length,
      messageIds: [],
    });
  }

  // ── Immediate send ────────────────────────────────────────────────────────────

  let recipientCount = 0;
  let messageIds: string[] = [];
  let sendSuccess = false;

  if (channel === "sms") {
    // Build recipient list with valid phone numbers
    const smsRecipients = recipients
      .filter((r) => r.phone_number)
      .map((r) => ({ phone: r.phone_number!, name: r.full_name }));

    const noPhonesCount = recipients.length - smsRecipients.length;
    if (noPhonesCount > 0)
      console.warn(
        `[communications/send] ${noPhonesCount} recipients have no phone number — skipped`,
      );

    if (smsRecipients.length === 0) {
      return NextResponse.json(
        {
          success: false,
          recipientCount: 0,
          messageIds: [],
          error: "None of the selected recipients have a phone number on file.",
        },
        { status: 400 },
      );
    }

    const result = await sendBulkSms(smsRecipients, body);
    recipientCount = result.sent;
    messageIds = result.results
      .filter((r) => r.messageId)
      .map((r) => r.messageId!);
    sendSuccess = result.failed === 0;

    console.log("[communications/send] SMS result:", {
      sent: result.sent,
      failed: result.failed,
    });
  } else {
    // Email via Resend
    const result = await broadcastEmail({
      recipients,
      subject,
      body,
      senderLabel,
      attachments,
    });
    recipientCount = result.recipientCount;
    messageIds = result.messageIds;
    sendSuccess = result.success;
  }

  // Log to DB
  await supabase.from("communications_log").insert({
    sent_by: user.id,
    audience_type: audience.type,
    audience_label: audienceLabel,
    channel,
    subject: channel === "sms" ? "(SMS)" : subject,
    body_preview: body.slice(0, 120).replace(/\n/g, " "),
    recipient_count: recipientCount,
    status: sendSuccess ? "sent" : "failed",
    scheduled_at: null,
    sent_at: new Date().toISOString(),
  });

  if (!sendSuccess && recipientCount === 0) {
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "All sends failed. Check AT/Resend credentials.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: sendSuccess,
    recipientCount,
    messageIds,
  });
}
