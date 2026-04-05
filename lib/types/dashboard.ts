// ── Teacher Status & Core ─────────────────────────────────────────────────────

export type TeacherStatus = "active" | "on_leave" | "resigned" | "terminated";

export interface Teacher {
  id: string;
  staff_id: string;
  full_name: string;
  tsc_number: string | null;
  email: string;
  phone_number: string | null;
  status: TeacherStatus;
  last_invite_sent: string | null;
  created_at: string;
  invite_accepted: boolean;
  avatar_url: string | null;
}

// ── Classes & Infrastructure (NEW) ───────────────────────────────────────────

export interface Class {
  id: string;
  grade: string;
  stream: string;
  academic_year: number;
  level: "lower_primary" | "upper_primary" | "junior_secondary";
}

// ── Teacher Governance ────────────────────────────────────────────────────────

export interface AllocationRow {
  id: string;
  subjectName: string;
  subjectCode: string;
  class_id: string;
  grade: string; // We keep these for easy UI display
  stream: string;
}

export interface TeacherStats {
  totalClasses: number;
  totalStudents: number;
  yearsAtKibali: number;
  assessedStrands: number;
}

export interface ClassTeacherAssignment {
  id: string;
  class_id: string;
  grade: string;
  stream: string;
  academicYear: number;
  isActive: boolean;
  assignedAt: string;
  relievedAt: string | null;
}

// ── Student & Parent ──────────────────────────────────────────────────────────

export type StudentStatus =
  | "active"
  | "transferred"
  | "graduated"
  | "withdrawn";

export interface StudentParentLink {
  parent_id: string;
  full_name: string;
  phone_number: string | null;
  email: string;
  relationship_type: string;
  is_primary_contact: boolean;
  invite_accepted: boolean;
}

export interface Student {
  id: string;
  readable_id: string | null;
  upi_number: string | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  class_id: string | null; // Updated from current_grade string
  current_grade: string; // Keeping for UI display convenience
  current_stream: string;
  photo_url: string | null;
  status: StudentStatus;
  all_parents: StudentParentLink[];
  created_at: string;
  parents: {
    id: string;
    full_name: string;
    phone_number: string | null;
  } | null;
}

// ── Dashboard & Charts ────────────────────────────────────────────────────────

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
}

// Result type for Server Actions
export type ActionResult =
  | { success: true; message: string }
  | { success: false; message: string };

// ── Parent & Communication (NEW) ──────────────────────────────────────────────

export interface Parent {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  invite_accepted: boolean;
  last_invite_sent: string | null;
  created_at: string;
  // The drawer maps over this to show the "Children" tab
  children: {
    id: string;
    full_name: string;
    current_grade: string;
    status: StudentStatus;
    photo_url: string | null;
  }[];
}

export interface ParentFeeBalance {
  student_id: string;
  total_due: number;
  total_paid: number;
  balance: number;
}

export interface ParentNotificationSummary {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  student_name: string;
  created_at: string;
  is_read: boolean;
}
