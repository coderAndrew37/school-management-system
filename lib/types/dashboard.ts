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

export interface Student {
  id: string;
  readable_id: string | null;
  upi_number: string | null;
  full_name: string;
  date_of_birth: string;
  gender: "Male" | "Female" | null;
  current_grade: string;
  photo_url: string | null;
  parent_id: string | null; // always null — kept for legacy compat
  created_at: string;
  // joined from student_parents → parents
  parents: Pick<Parent, "id" | "full_name" | "phone_number"> | null;
}

export interface DashboardStats {
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
}
