// lib/utils/communication-templates.ts

import type {
  AudienceType,
  MessageTemplate,
  SmsTemplate,
  SmsTemplateId,
  TemplateId,
} from "@/lib/types/communications";

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

export const MESSAGE_TEMPLATES: Record<TemplateId, MessageTemplate> = {
  blank: {
    id: "blank",
    label: "Blank",
    icon: "✏️",
    defaultSubject: "",
    defaultBody: "",
    audienceHint: [
      "single_teacher",
      "all_teachers",
      "single_parent",
      "all_parents",
      "grade_parents",
      "all_staff_and_parents",
    ],
  },

  fee_reminder: {
    id: "fee_reminder",
    label: "Fee Reminder",
    icon: "💳",
    defaultSubject: "Reminder: School Fees Due — Term 2, 2026",
    defaultBody: `Dear Parent/Guardian,

This is a friendly reminder that school fees for Term 2, 2026 are now due.

Please ensure full payment is made by the end of this week to avoid disruption to your child's learning.

Payment can be made via M-Pesa to our school paybill or at the school finance office.

If you have already made payment, please disregard this notice or forward your receipt to the finance office for confirmation.

Warm regards,
Kibali Academy Finance Office`,
    audienceHint: ["all_parents", "grade_parents", "single_parent"],
  },

  event_notice: {
    id: "event_notice",
    label: "Event Notice",
    icon: "📅",
    defaultSubject: "Upcoming School Event — [Event Name]",
    defaultBody: `Dear Parent/Guardian,

We are pleased to invite you to [Event Name], which will be held on [Date] at [Time] at the Kibali Academy main hall.

This is a wonderful opportunity to engage with the school community and celebrate our learners' achievements.

Please confirm your attendance by replying to this email or contacting the school office.

We look forward to seeing you.

Warm regards,
Kibali Academy Administration`,
    audienceHint: ["all_parents", "grade_parents", "all_staff_and_parents"],
  },

  term_dates: {
    id: "term_dates",
    label: "Term Dates",
    icon: "🗓️",
    defaultSubject: "Academic Calendar — Term Dates 2026",
    defaultBody: `Dear Parent/Guardian,

Please find below the official term dates for the 2026 academic year:

Term 1: 6 January — 28 March 2026
Term 2: 4 May — 1 August 2026
Term 3: 24 August — 14 November 2026

Mid-term breaks and public holidays will be communicated separately. Please plan accordingly and ensure your child is in school on all scheduled days.

Warm regards,
Kibali Academy Administration`,
    audienceHint: ["all_parents", "all_staff_and_parents"],
  },

  emergency_closure: {
    id: "emergency_closure",
    label: "Emergency Closure",
    icon: "🚨",
    defaultSubject: "URGENT: School Closure Notice — [Date]",
    defaultBody: `Dear Parent/Guardian,

Due to [reason], Kibali Academy will be closed on [Date].

Please make alternative arrangements for your child's supervision. Learning activities for the day will be shared via the parent portal.

We apologise for the inconvenience and will keep you updated as the situation develops.

For urgent queries, please contact the school office directly.

Kibali Academy Administration`,
    audienceHint: ["all_parents", "all_staff_and_parents"],
  },

  report_available: {
    id: "report_available",
    label: "Report Available",
    icon: "📊",
    defaultSubject: "CBC Progress Report Ready — Term [X], 2026",
    defaultBody: `Dear Parent/Guardian,

Your child's CBC Progress Report for Term [X] 2026 is now available on the Kibali Academy Parent Portal.

Log in to view detailed assessment results across all subjects, teacher remarks, and your child's overall performance level.

If you need assistance accessing the portal, please contact the school office.

Warm regards,
Kibali Academy Academic Office`,
    audienceHint: ["all_parents", "grade_parents", "single_parent"],
  },

  staff_meeting: {
    id: "staff_meeting",
    label: "Staff Meeting",
    icon: "👥",
    defaultSubject: "Staff Meeting — [Date] at [Time]",
    defaultBody: `Dear Team,

You are invited to a staff meeting scheduled for [Date] at [Time] in the staffroom.

Agenda:
1. Term review and curriculum updates
2. CBC assessment moderation
3. Student welfare matters
4. Any other business

Attendance is compulsory. Please prepare any relevant reports or documents in advance.

Thank you,
The Administration`,
    audienceHint: ["all_teachers", "single_teacher"],
  },
};

export function getTemplatesForAudience(
  audienceType: AudienceType,
): MessageTemplate[] {
  return Object.values(MESSAGE_TEMPLATES).filter((t) =>
    t.audienceHint.includes(audienceType),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMS TEMPLATES
// Plain text only. Max 160 chars for single SMS, 459 chars for 3-part.
// Each template shows its char count in the label to help the admin stay
// within budget. [PLACEHOLDERS] are in square brackets for easy scanning.
// ─────────────────────────────────────────────────────────────────────────────

export const SMS_TEMPLATES: Record<SmsTemplateId, SmsTemplate> = {
  sms_blank: {
    id: "sms_blank",
    label: "Blank",
    icon: "✏️",
    body: "",
    audienceHint: [
      "single_teacher",
      "all_teachers",
      "single_parent",
      "all_parents",
      "grade_parents",
      "all_staff_and_parents",
    ],
    charHint: 0,
  },

  sms_fee_reminder: {
    id: "sms_fee_reminder",
    label: "Fee Reminder",
    icon: "💳",
    // 138 chars
    body: "Kibali Academy: School fees for Term [X] 2026 are due. Pay via M-Pesa Paybill [XXXX] or visit the finance office. Thank you.",
    audienceHint: ["all_parents", "grade_parents", "single_parent"],
    charHint: 124,
  },

  sms_fee_overdue: {
    id: "sms_fee_overdue",
    label: "Fee Overdue",
    icon: "⚠️",
    // 152 chars
    body: "KIBALI ACADEMY: Fees for [STUDENT NAME] are overdue. Please clear KES [AMOUNT] by [DATE] to avoid disruption. Contact office: [PHONE].",
    audienceHint: ["single_parent", "grade_parents"],
    charHint: 135,
  },

  sms_event_notice: {
    id: "sms_event_notice",
    label: "Event Notice",
    icon: "📅",
    // 136 chars
    body: "Kibali Academy: You are invited to [EVENT] on [DATE] at [TIME], school grounds. Confirm attendance at the office. We look forward to seeing you.",
    audienceHint: ["all_parents", "grade_parents", "all_staff_and_parents"],
    charHint: 144,
  },

  sms_term_dates: {
    id: "sms_term_dates",
    label: "Term Dates",
    icon: "🗓️",
    // 143 chars
    body: "Kibali Academy 2026 term dates: T1: 6 Jan-28 Mar. T2: 4 May-1 Aug. T3: 24 Aug-14 Nov. Plan early. Queries: contact the school office.",
    audienceHint: ["all_parents", "all_staff_and_parents"],
    charHint: 134,
  },

  sms_emergency_closure: {
    id: "sms_emergency_closure",
    label: "Emergency Closure",
    icon: "🚨",
    // 141 chars — kept short for urgency
    body: "URGENT - Kibali Academy: School is closed on [DATE] due to [REASON]. Please make arrangements for your child. Updates via the parent portal.",
    audienceHint: ["all_parents", "grade_parents", "all_staff_and_parents"],
    charHint: 141,
  },

  sms_report_available: {
    id: "sms_report_available",
    label: "Report Ready",
    icon: "📊",
    // 134 chars
    body: "Kibali Academy: Your child's Term [X] 2026 CBC report is ready. Log in at [PORTAL URL] to view results and teacher remarks.",
    audienceHint: ["all_parents", "grade_parents", "single_parent"],
    charHint: 123,
  },

  sms_absence_alert: {
    id: "sms_absence_alert",
    label: "Absence Alert",
    icon: "📋",
    // 138 chars
    body: "Kibali Academy: [STUDENT NAME] was marked absent today, [DATE]. If this is unexpected, please contact the class teacher or school office.",
    audienceHint: ["single_parent"],
    charHint: 137,
  },

  sms_early_dismissal: {
    id: "sms_early_dismissal",
    label: "Early Dismissal",
    icon: "🏃",
    // 131 chars
    body: "Kibali Academy: School will close early at [TIME] on [DATE] due to [REASON]. Please arrange to pick up your child on time.",
    audienceHint: ["all_parents", "grade_parents"],
    charHint: 123,
  },

  sms_payment_received: {
    id: "sms_payment_received",
    label: "Payment Confirmed",
    icon: "✅",
    // 127 chars
    body: "Kibali Academy: Payment of KES [AMOUNT] for [STUDENT NAME] received on [DATE]. Receipt no: [REF]. Thank you. Finance Office.",
    audienceHint: ["single_parent"],
    charHint: 124,
  },

  sms_staff_meeting: {
    id: "sms_staff_meeting",
    label: "Staff Meeting",
    icon: "👥",
    // 117 chars
    body: "Kibali Academy Staff: Mandatory meeting on [DATE] at [TIME] in the staffroom. Prepare term reports. Regards, Administration.",
    audienceHint: ["all_teachers", "single_teacher"],
    charHint: 124,
  },

  sms_exam_reminder: {
    id: "sms_exam_reminder",
    label: "Exam Reminder",
    icon: "📝",
    // 148 chars
    body: "Kibali Academy: End of term assessments for [GRADE] begin on [DATE]. Ensure your child attends school with all required materials. Office: [PHONE].",
    audienceHint: ["grade_parents", "all_parents"],
    charHint: 147,
  },
};

export function getSmsTemplatesForAudience(
  audienceType: AudienceType,
): SmsTemplate[] {
  return Object.values(SMS_TEMPLATES).filter((t) =>
    t.audienceHint.includes(audienceType),
  );
}

// ── Labels ────────────────────────────────────────────────────────────────────

export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  single_teacher: "Specific Teacher",
  all_teachers: "All Teachers",
  single_parent: "Specific Parent",
  all_parents: "All Parents",
  grade_parents: "Parents by Grade",
  all_staff_and_parents: "Everyone",
};
