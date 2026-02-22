import type {
  AudienceType,
  MessageTemplate,
  TemplateId,
} from "@/lib/types/communications";

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

/** Returns templates relevant to the selected audience type */
export function getTemplatesForAudience(
  audienceType: AudienceType,
): MessageTemplate[] {
  return Object.values(MESSAGE_TEMPLATES).filter((t) =>
    t.audienceHint.includes(audienceType),
  );
}

/** Human-readable label for each audience type */
export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  single_teacher: "Specific Teacher",
  all_teachers: "All Teachers",
  single_parent: "Specific Parent",
  all_parents: "All Parents",
  grade_parents: "Parents by Grade",
  all_staff_and_parents: "Everyone",
};
