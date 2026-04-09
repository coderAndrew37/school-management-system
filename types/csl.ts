// ============================================================
// lib/types/csl.ts
// Strictly-typed interfaces for CSL Logbook + Student Transfers
// ============================================================

import type { CbcScore } from "@/types/knec";

// ── CSL enums (mirror DB enums exactly) ───────────────────────────────────────

export const CSL_STRANDS = [
  "Environment",
  "Citizenship",
  "Social Justice",
  "Health & Wellbeing",
  "Cultural Heritage",
  "Technology & Innovation",
  "Entrepreneurship",
  "Community Service",
] as const;

export type CSLStrand = (typeof CSL_STRANDS)[number];

export const SUPERVISOR_STATUSES = ["pending", "approved", "rejected"] as const;
export type SupervisorStatus = (typeof SUPERVISOR_STATUSES)[number];

// ── Core Competencies (CBC JSS) ───────────────────────────────────────────────

export const CORE_COMPETENCIES = [
  "Communication",
  "Collaboration",
  "Critical Thinking",
  "Creativity & Imagination",
  "Citizenship",
  "Digital Literacy",
  "Learning to Learn",
  "Self-Efficacy",
] as const;

export type CoreCompetency = (typeof CORE_COMPETENCIES)[number];

// ── CSL hour targets ──────────────────────────────────────────────────────────

/** KNEC JSS target: 20 hours of CSL per academic year */
export const CSL_HOUR_TARGET = 20;

/** Reflection quality thresholds for CSL Performance Level calculation */
export const CSL_REFLECTION_MIN_WORDS = 30;

// ── CSL Performance Level (maps to KNEC SBA grade) ───────────────────────────

export type CSLPerformanceLevel = "EE" | "ME" | "AE" | "BE";

export interface CSLPerformanceResult {
  level: CSLPerformanceLevel;
  totalHours: number;
  approvedHours: number;
  hoursTarget: number;
  hoursPct: number; // totalHours / hoursTarget * 100
  entryCount: number;
  approvedCount: number;
  /** Average reflection word count across entries */
  avgReflectionWords: number;
  /** Whether all entries have been supervisor-approved */
  fullyApproved: boolean;
  /** Human-readable summary for the admin dashboard */
  summary: string;
}

// ── DB row type ───────────────────────────────────────────────────────────────

export interface DbCSLEntry {
  id: string;
  student_id: string;
  academic_year: number;
  project_title: string;
  strand: CSLStrand;
  activity_description: string;
  hours_spent: number;
  competencies_addressed: string[];
  student_reflection: string;
  supervisor_id: string | null;
  supervisor_status: SupervisorStatus;
  supervisor_notes: string | null;
  evidence_url: string | null;
  created_at: string;
  updated_at: string;
}

// ── Form values (used by LogEntryForm + server action) ────────────────────────

export interface CSLEntryFormValues {
  projectTitle: string;
  strand: CSLStrand;
  activityDescription: string;
  hoursSpent: number;
  competenciesAddressed: CoreCompetency[];
  studentReflection: string;
  evidenceUrl: string;
}

// ── CSL student summary (for admin dashboard row) ─────────────────────────────

export interface CSLStudentSummary {
  studentId: string;
  fullName: string;
  upiNumber: string | null;
  entries: DbCSLEntry[];
  performance: CSLPerformanceResult;
  /** KNEC SBA score mapped from CSL performance (same as performance.level) */
  sbaGrade: CbcScore;
}

// ── Transfer types ─────────────────────────────────────────────────────────────

export const TRANSFER_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "completed",
] as const;
export const TRANSFER_DIRECTIONS = ["outbound", "inbound"] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export type TransferDirection = (typeof TRANSFER_DIRECTIONS)[number];

/** QR code payload — encoded as JSON, scanned by the receiving school */
export interface QRTransferPayload {
  upi: string;
  assessment_number: string | null;
  full_name: string;
  current_grade: string;
  current_school_code: string;
  /** ISO timestamp of QR generation — for expiry validation */
  generated_at: string;
}

/** DB row for transfer_requests */
export interface DbTransferRequest {
  id: string;
  student_id: string;
  direction: TransferDirection;
  status: TransferStatus;
  destination_school: string | null;
  reason: string | null;
  clearance_pdf_url: string | null;
  source_school_code: string | null;
  source_upi: string | null;
  source_assessment_no: string | null;
  scanned_qr_payload: QRTransferPayload | null;
  initiated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** Joined from students */
  student?: TransferStudentSnippet;
}

export interface TransferStudentSnippet {
  id: string;
  full_name: string;
  upi_number: string | null;
  current_grade: string;
  readable_id: string | null;
  status: string;
  /** Added: Used to determine the target class during inbound approval */
  class_id?: string | null; 
}

// ── Transfer action inputs ────────────────────────────────────────────────────

export interface InitiateOutboundInput {
  studentId: string;
  destinationSchool: string;
  reason: string;
}

export interface ApproveInboundInput {
  transferId: string;
  studentId: string;
  /** Added: Approval now requires a target class to restore student records */
  classId: string; 
}

export interface InboundScanInput {
  payload: QRTransferPayload;
  scannedBy: string; // admin user id
}