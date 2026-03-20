// ── Audience targeting ────────────────────────────────────────────────────────

export type AudienceType =
  | "single_teacher"
  | "all_teachers"
  | "single_parent"
  | "all_parents"
  | "grade_parents"
  | "all_staff_and_parents";

// Channel: email (via Resend) or sms (via Africa's Talking)
export type SendChannel = "email" | "sms";

export interface SingleRecipient {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string | null; // needed for SMS channel
}

export interface AudienceSelection {
  type: AudienceType;
  individual: SingleRecipient | null;
  grade: string | null;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export type TemplateId =
  | "blank"
  | "fee_reminder"
  | "event_notice"
  | "term_dates"
  | "emergency_closure"
  | "report_available"
  | "staff_meeting";

export interface MessageTemplate {
  id: TemplateId;
  label: string;
  icon: string;
  defaultSubject: string;
  defaultBody: string;
  audienceHint: AudienceType[];
}

// ── Attachments ───────────────────────────────────────────────────────────────

export interface AttachmentFile {
  file: File;
  name: string;
  size: number;
  base64: string;
}

// ── Compose form state ────────────────────────────────────────────────────────

export interface ComposeFormState {
  channel: SendChannel;
  audience: AudienceSelection;
  templateId: TemplateId;
  subject: string;
  body: string;
  attachments: AttachmentFile[];
  scheduledAt: string | null;
}

// ── API request / response ────────────────────────────────────────────────────

export interface SendEmailRequest {
  channel: SendChannel;
  audience: AudienceSelection;
  subject: string;
  body: string;
  attachments: Array<{ name: string; base64: string; mimeType: string }>;
  scheduledAt: string | null;
}

export interface SendEmailResponse {
  success: boolean;
  recipientCount: number;
  messageIds: string[];
  error?: string;
}

// ── Sent log ──────────────────────────────────────────────────────────────────

export type CommunicationStatus = "sent" | "scheduled" | "failed";

export interface CommunicationLogEntry {
  id: string;
  audience_type: AudienceType;
  audience_label: string;
  subject: string;
  body_preview: string;
  recipient_count: number;
  status: CommunicationStatus;
  channel: SendChannel;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  sent_by_name: string;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

export interface RecipientsPayload {
  teachers: SingleRecipient[];
  parents: SingleRecipient[];
  grades: string[];
}

// ── Component props ───────────────────────────────────────────────────────────

export interface CommunicationsClientProps {
  recipients: RecipientsPayload;
  sentLog: CommunicationLogEntry[];
  grades: string[];
}

export interface SentHistoryProps {
  log: CommunicationLogEntry[];
}

export interface AttachmentUploaderProps {
  attachments: AttachmentFile[];
  onChange: (attachments: AttachmentFile[]) => void;
}
