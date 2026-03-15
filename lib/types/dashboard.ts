export interface Teacher {
  id: string;
  full_name: string;
  tsc_number: string | null;
  email: string;
  phone_number: string | null;
  created_at: string;
}

export interface Parent {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  created_at: string;
  invite_accepted: boolean;
  last_invite_sent: string;
}

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
  // joined from student_parents → parents
  parents: Pick<Parent, "id" | "full_name" | "phone_number"> | null;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
}
