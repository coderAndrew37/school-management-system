// lib/types/dashboard.ts

export type TeacherStatus = "active" | "on_leave" | "resigned" | "terminated";

export interface Teacher {
  id: string;
  full_name: string;
  tsc_number: string | null;
  email: string;
  phone_number: string | null;
  status: TeacherStatus;
  last_invite_sent: string | null;
  created_at: string;
}

// ── Parent ────────────────────────────────────────────────────────────────────

export interface ParentChild {
  id: string;
  full_name: string;
  current_grade: string;
  photo_url: string | null;
  status: StudentStatus;
}

export interface ParentFeeBalance {
  student_id: string;
  student_name: string;
  total_paid: number;
  total_due: number;
  balance: number;
}

export interface ParentNotificationSummary {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
  student_name: string;
}

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

// ── Student ───────────────────────────────────────────────────────────────────

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
  current_grade: string;
  photo_url: string | null;
  status: StudentStatus;
  parent_id: string | null;
  all_parents: StudentParentLink[];
  created_at: string;
  parents: Pick<Parent, "id" | "full_name" | "phone_number"> | null;
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
}
