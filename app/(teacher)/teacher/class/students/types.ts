export interface StudentWithStats {
  id: string;
  full_name: string;
  readable_id: string | null;
  upi_number: string | null;
  gender: "Male" | "Female" | null;
  date_of_birth: string;
  current_grade: string;
  // attendance this term
  present: number;
  absent: number;
  late: number;
  total_days: number;
  attendance_rate: number;
  // latest assessment count
  assessment_count: number;
  // parent contact
  parent_name: string | null;
  parent_phone: string | null;
  parent_email: string | null;
}
