// lib/types/dashboard.ts

export interface Teacher {
  id: string;
  full_name: string;
  tsc_number: string | null;
  email: string;
  phone_number: string | null;
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
  balance: number; // positive = credit, negative = owes money
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
  phone_number: string | null; // nullable — not always collected
  created_at: string;
  invite_accepted: boolean;
  last_invite_sent: string | null; // null if invite never sent
  // joined from student_parents → students
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
  parent_id: string | null; // always null — kept for legacy compat
  all_parents: StudentParentLink[]; // all linked parents, not just primary
  created_at: string;
  // joined from student_parents → parents (primary contact only)
  parents: Pick<Parent, "id" | "full_name" | "phone_number"> | null;
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
}
