// ── Teacher Status & Core ─────────────────────────────────────────────────────

export type TeacherStatus = "active" | "on_leave" | "resigned" | "terminated";

export interface Teacher {
  id: string;
  staff_id: string; // The human-readable KIB-T-XXXX
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

// ── Teacher Governance (NEW) ──────────────────────────────────────────────────

export interface AllocationRow {
  id: string;
  subjectName: string;
  subjectCode: string;
  grade: string;
}

export interface TeacherStats {
  totalClasses: number;
  totalStudents: number;
  yearsAtKibali: number;
  assessedStrands: number;
}

export interface ClassTeacherGrade {
  grade: string;
  academicYear: number;
}

// ── Student & Parent ──────────────────────────────────────────────────────────

export type StudentStatus =
  | "active"
  | "transferred"
  | "graduated"
  | "withdrawn";

export interface Parent {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  invite_accepted: boolean;
  last_invite_sent: string | null;
  children: ParentChild[];
}

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
  current_grade: string;
  photo_url: string | null;
  status: StudentStatus;
  parent_id: string | null;
  all_parents: StudentParentLink[];
  created_at: string;
  parents: Pick<Parent, "id" | "full_name" | "phone_number"> | null;
}

export interface ParentChild {
  id: string;
  full_name: string;
  current_grade: string;
  photo_url: string | null;
  status: StudentStatus;
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
