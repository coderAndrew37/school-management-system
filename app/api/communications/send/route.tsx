import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  SendEmailRequest,
  SendEmailResponse,
  AudienceType,
} from "@/lib/types/communications";
import { resolveAudienceRecipients, broadcastEmail } from "@/lib/mail";

// ── Audience label builder ────────────────────────────────────────────────────

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
    case "single_parent":
    case "all_parents":
    case "grade_parents":
      return "Message from Kibali Academy";
  }
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
): Promise<NextResponse<SendEmailResponse>> {
  const supabase = await createSupabaseServerClient();

  // Auth guard — must be admin
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || user === null) {
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "Unauthorised",
      },
      { status: 401 },
    );
  }

  const profileRes = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  if (profileRes.data?.role !== "admin") {
    return NextResponse.json(
      { success: false, recipientCount: 0, messageIds: [], error: "Forbidden" },
      { status: 403 },
    );
  }

  // Parse body
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

  const { audience, subject, body, attachments, scheduledAt } = payload;

  if (!subject.trim() || !body.trim()) {
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "Subject and body are required",
      },
      { status: 400 },
    );
  }

  // Resolve recipients server-side
  const recipients = await resolveAudienceRecipients(audience);

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "No recipients found for this audience",
      },
      { status: 400 },
    );
  }

  const audienceLabel = buildAudienceLabel(payload);
  const senderLabel = buildSenderLabel(audience.type);
  const bodyPreview = body.slice(0, 120).replace(/\n/g, " ");

  // If scheduled, log it and return — actual sending is handled by a cron job
  if (scheduledAt !== null) {
    const { error: logError } = await supabase
      .from("communications_log")
      .insert({
        sent_by: user.id,
        audience_type: audience.type,
        audience_label: audienceLabel,
        subject,
        body_preview: bodyPreview,
        recipient_count: recipients.length,
        status: "scheduled",
        scheduled_at: scheduledAt,
        sent_at: null,
      });

    if (logError) console.error("Log insert error:", logError);

    return NextResponse.json({
      success: true,
      recipientCount: recipients.length,
      messageIds: [],
    });
  }

  // Send immediately
  const result = await broadcastEmail({
    recipients,
    subject,
    body,
    senderLabel,
    attachments,
  });

  // Log to DB
  const { error: logError } = await supabase.from("communications_log").insert({
    sent_by: user.id,
    audience_type: audience.type,
    audience_label: audienceLabel,
    subject,
    body_preview: bodyPreview,
    recipient_count: result.recipientCount,
    status: result.success ? "sent" : "failed",
    scheduled_at: null,
    sent_at: new Date().toISOString(),
  });

  if (logError) console.error("Log insert error:", logError);

  if (!result.success && result.recipientCount === 0) {
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "All sends failed. Check server logs.",
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: result.success,
    recipientCount: result.recipientCount,
    messageIds: result.messageIds,
  });
}
