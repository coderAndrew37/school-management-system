// ── Audience targeting ────────────────────────────────────────────────────────

export type AudienceType =
  | "single_teacher"
  | "all_teachers"
  | "single_parent"
  | "all_parents"
  | "grade_parents"
  | "all_staff_and_parents";

export interface SingleRecipient {
  id: string;
  full_name: string;
  email: string;
}

export interface AudienceSelection {
  type: AudienceType;
  /** Populated when type is 'single_teacher' or 'single_parent' */
  individual: SingleRecipient | null;
  /** Populated when type is 'grade_parents' */
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
  /** Which audience types this template is appropriate for */
  audienceHint: AudienceType[];
}

// ── Attachments ───────────────────────────────────────────────────────────────

export interface AttachmentFile {
  /** Browser File object (client-side only) */
  file: File;
  /** Preview name shown in the UI */
  name: string;
  /** Size in bytes */
  size: number;
  /** Base64-encoded content for sending via API */
  base64: string;
}

// ── Compose form state ────────────────────────────────────────────────────────

export interface ComposeFormState {
  audience: AudienceSelection;
  templateId: TemplateId;
  subject: string;
  body: string;
  attachments: AttachmentFile[];
  scheduledAt: string | null; // ISO 8601 or null for immediate
}

// ── API request / response ────────────────────────────────────────────────────

export interface SendEmailRequest {
  audience: AudienceSelection;
  subject: string;
  body: string;
  attachments: Array<{
    name: string;
    base64: string;
    mimeType: string;
  }>;
  scheduledAt: string | null;
}

export interface SendEmailResponse {
  success: boolean;
  recipientCount: number;
  messageIds: string[];
  error?: string;
}

// ── Sent log (maps to communications_log DB table) ────────────────────────────

export type CommunicationStatus = "sent" | "scheduled" | "failed";

export interface CommunicationLogEntry {
  id: string;
  audience_type: AudienceType;
  audience_label: string; // human-readable e.g. "All Parents" or "John Kamau"
  subject: string;
  body_preview: string;  // first 120 chars
  recipient_count: number;
  status: CommunicationStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  sent_by_name: string; // denormalised from profiles
}

// ── Data fetching ─────────────────────────────────────────────────────────────

export interface RecipientsPayload {
  teachers: SingleRecipient[];
  parents: SingleRecipient[];
  grades: string[];
}

// ── Component prop interfaces ─────────────────────────────────────────────────

export interface CommunicationsClientProps {
  recipients: RecipientsPayload;
  sentLog: CommunicationLogEntry[];
  grades: string[];
}

export interface AudienceSelectorProps {
  value: AudienceSelection;
  recipients: RecipientsPayload;
  onChange: (value: AudienceSelection) => void;
}

export interface TemplateSelectorProps {
  value: TemplateId;
  audienceType: AudienceType;
  onChange: (templateId: TemplateId, template: MessageTemplate) => void;
}

export interface ComposerProps {
  formState: ComposeFormState;
  recipients: RecipientsPayload;
  onUpdate: (patch: Partial<ComposeFormState>) => void;
  onSend: () => Promise<void>;
  sending: boolean;
}

export interface SentHistoryProps {
  log: CommunicationLogEntry[];
}

export interface RecipientPreviewProps {
  audience: AudienceSelection;
  recipients: RecipientsPayload;
}

export interface AttachmentUploaderProps {
  attachments: AttachmentFile[];
  onChange: (attachments: AttachmentFile[]) => void;
}