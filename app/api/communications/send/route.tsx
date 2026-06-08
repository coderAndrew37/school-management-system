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
    default:
      return "General Audience";
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
  const logPrefix = `[${new Date().toISOString()}] [COMM_API]`;
  console.log(`${logPrefix} 🚀 Initialization: Starting send process...`);

  const supabase = await createSupabaseServerClient();

  // 1. Auth Guard Validation
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error(`${logPrefix} ❌ Auth Error:`, authError?.message || "No user found");
    return NextResponse.json(
      { success: false, recipientCount: 0, messageIds: [], error: "Unauthorised" },
      { status: 401 },
    );
  }
  console.log(`${logPrefix} ✅ Authenticated as: ${user.email} (ID: ${user.id})`);

  // 2. Granular Permissions & Base Role Check 
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("school_id, base_role, is_super_admin, is_dev, allowed_permissions_override")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.warn(`${logPrefix} ⚠️ Profile Verification Failure:`, profileError?.message);
    return NextResponse.json(
      { success: false, recipientCount: 0, messageIds: [], error: "Forbidden" },
      { status: 403 },
    );
  }

  const hasCommunicationAuthority =
    profile.is_super_admin ||
    profile.is_dev ||
    profile.allowed_permissions_override?.includes("manage_communications");

  if (!hasCommunicationAuthority || !profile.school_id) {
    console.warn(`${logPrefix} ⚠️ Forbidden: Insufficient clearance tokens for resource modification.`);
    return NextResponse.json(
      { success: false, recipientCount: 0, messageIds: [], error: "Forbidden" },
      { status: 403 },
    );
  }
  console.log(`${logPrefix} ✅ Permission Cleared for School Context ID: ${profile.school_id}`);

  // 3. Payload Parsing Validation
  let payload: SendEmailRequest;
  try {
    payload = (await req.json()) as SendEmailRequest;
    console.log(`${logPrefix} 📥 Payload Extracted:`, {
      channel: payload.channel,
      audienceType: payload.audience.type,
      subject: payload.subject,
      bodyLength: payload.body?.length,
    });
  } catch (err) {
    console.error(`${logPrefix} ❌ Payload Parse Failure`);
    return NextResponse.json(
      { success: false, recipientCount: 0, messageIds: [], error: "Invalid request body" },
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

  // 4. Content Content Integrity Checks
  if (!body.trim()) {
    console.warn(`${logPrefix} ⚠️ Validation Failed: Empty message body`);
    return NextResponse.json(
      { success: false, recipientCount: 0, messageIds: [], error: "Message body is required" },
      { status: 400 },
    );
  }

  if (channel === "email" && !subject.trim()) {
    console.warn(`${logPrefix} ⚠️ Validation Failed: Missing email subject`);
    return NextResponse.json(
      { success: false, recipientCount: 0, messageIds: [], error: "Subject is required for email" },
      { status: 400 },
    );
  }

  // 5. Multi-Tenant Recipient Isolation Injection
  console.log(`${logPrefix} 🔍 Resolving recipients for audience type: ${audience.type}`);
  
  // NOTE: Ensure your resolveAudienceRecipients framework utility receives the tenant identifier argument
  const recipients = await resolveAudienceRecipients(audience, profile.school_id);
  console.log(`${logPrefix} 👥 Database Query Result: Found ${recipients.length} potential recipients`);

  if (recipients.length === 0) {
    console.error(`${logPrefix} ❌ Stop: No recipients returned from resolveAudienceRecipients`);
    return NextResponse.json(
      { success: false, recipientCount: 0, messageIds: [], error: "No recipients found for this audience" },
      { status: 400 },
    );
  }

  const audienceLabel = buildAudienceLabel(payload);
  const senderLabel = buildSenderLabel(audience.type);

  // 6. Scheduling Transaction Processing
  if (scheduledAt) {
    console.log(`${logPrefix} ⏰ Action: Scheduling message for ${scheduledAt}`);
    const { error: logError } = await supabase
      .from("communications_log")
      .insert({
        school_id: profile.school_id, // Mandatory multi-tenant key tracking constraint
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

    if (logError) console.error(`${logPrefix} ❌ DB Log Error (Scheduling):`, logError.message);

    return NextResponse.json({
      success: true,
      recipientCount: recipients.length,
      messageIds: [],
    });
  }

  // 7. Core Delivery Dispatches
  let recipientCount = 0;
  let messageIds: string[] = [];
  let sendSuccess = false;

  if (channel === "sms") {
    console.log(`${logPrefix} 📱 Processing SMS channel...`);

    const smsRecipients = recipients
      .filter((r) => {
        const hasPhone = Boolean(r.phone_number);
        if (!hasPhone) {
          console.warn(`${logPrefix} ⏭️ Skipping ${r.full_name || "unknown"}: Missing phone_number`);
        }
        return hasPhone;
      })
      .map((r) => ({ phone: r.phone_number!, name: r.full_name }));

    console.log(`${logPrefix} 📱 Filtered SMS list: ${smsRecipients.length} valid numbers out of ${recipients.length}`);

    if (smsRecipients.length === 0) {
      console.error(`${logPrefix} ❌ Stop: 0 recipients left after phone_number filtering`);
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

    console.log(`${logPrefix} 📡 Dispatching to Africa's Talking gateway...`);
    const result = await sendBulkSms(smsRecipients, body);

    recipientCount = result.sent;
    messageIds = result.results.filter((r) => r.messageId).map((r) => r.messageId!);
    sendSuccess = result.sent > 0 && result.failed === 0;

    console.log(`${logPrefix} 📊 SMS Provider Response:`, {
      sent: result.sent,
      failed: result.failed,
      resultsCount: result.results.length,
    });
  } else {
    console.log(`${logPrefix} 📧 Processing Email channel via Resend...`);
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
    console.log(`${logPrefix} 📊 Email Provider Response: success=${sendSuccess}, count=${recipientCount}`);
  }

  // 8. Final Transaction Logging Execution
  console.log(`${logPrefix} 📝 Logging final transaction status to DB...`);
  const { error: finalLogError } = await supabase
    .from("communications_log")
    .insert({
      school_id: profile.school_id, // Mandatory multi-tenant key tracking constraint
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

  if (finalLogError) console.error(`${logPrefix} ❌ DB Log Error (Final):`, finalLogError.message);

  if (!sendSuccess && recipientCount === 0) {
    console.error(`${logPrefix} ❌ Failure: Total failure in delivery channels.`);
    return NextResponse.json(
      {
        success: false,
        recipientCount: 0,
        messageIds: [],
        error: "All sends failed. Check provider credentials or logs.",
      },
      { status: 500 },
    );
  }

  console.log(`${logPrefix} ✨ Execution complete. Success: ${sendSuccess}, Total Sent: ${recipientCount}`);
  return NextResponse.json({
    success: sendSuccess,
    recipientCount,
    messageIds,
  });
}