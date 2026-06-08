// app/_components/communications/constants.ts

import { GraduationCap, User, Users, UsersRound } from "lucide-react";
import React from "react";
import type { AudienceSelection, AudienceType, ComposeFormState } from "@/lib/types/communications";

// ── SMS limits ────────────────────────────────────────────────────────────────

export const SMS_SINGLE = 160;
export const SMS_MULTI = 153; // GSM 7-bit multi-part
export const SMS_MAX_PARTS = 3;

// ── Audience options ──────────────────────────────────────────────────────────

export interface AudienceOption {
  type: AudienceType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  {
    type: "single_teacher",
    label: "Specific Teacher",
    icon: React.createElement(User, { className: "h-4 w-4" }),
    description: "One staff member",
  },
  {
    type: "all_teachers",
    label: "All Teachers",
    icon: React.createElement(Users, { className: "h-4 w-4" }),
    description: "Entire teaching staff",
  },
  {
    type: "single_parent",
    label: "Specific Parent",
    icon: React.createElement(User, { className: "h-4 w-4" }),
    description: "One parent or guardian",
  },
  {
    type: "all_parents",
    label: "All Parents",
    icon: React.createElement(UsersRound, { className: "h-4 w-4" }),
    description: "Every registered parent",
  },
  {
    type: "grade_parents",
    label: "Parents by Grade",
    icon: React.createElement(GraduationCap, { className: "h-4 w-4" }),
    description: "Parents of a specific class",
  },
  {
    type: "all_staff_and_parents",
    label: "Everyone",
    icon: React.createElement(UsersRound, { className: "h-4 w-4" }),
    description: "All staff and all parents",
  },
];

// ── Default state ─────────────────────────────────────────────────────────────

export const DEFAULT_AUDIENCE: AudienceSelection = {
  type: "all_parents",
  individual: null,
  grade: null,
};

export const DEFAULT_FORM: ComposeFormState = {
  channel: "email",
  audience: DEFAULT_AUDIENCE,
  templateId: "blank",
  smsTemplateId: "sms_blank",
  subject: "",
  body: "",
  attachments: [],
  scheduledAt: null,
};