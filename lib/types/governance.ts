// lib/types/governance.ts
import type { Class } from "./allocation";

export type AnnouncementAudience = "all" | "parents" | "teachers" | "grade";
export type AnnouncementPriority = "low" | "normal" | "high" | "urgent";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  target_class_id: string | null; // Refactored from target_grade
  priority: AnnouncementPriority;
  pinned: boolean;
  published_at: string;
  expires_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null } | null;
  classes?: Class | null; // Joined class data for display
}

// ── School Calendar ───────────────────────────────────────────────────────────

export type EventCategory =
  | "academic"
  | "sports"
  | "cultural"
  | "holiday"
  | "meeting"
  | "other";

export interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  target_class_ids: string[] | null; // Refactored from target_grades
  is_public: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export type InventoryCategory =
  | "furniture"
  | "electronics"
  | "sports"
  | "stationery"
  | "laboratory"
  | "books"
  | "kitchen"
  | "medical"
  | "maintenance"
  | "other";

export type ItemCondition = "new" | "good" | "fair" | "poor" | "condemned";

export type TransactionType =
  | "received"
  | "issued"
  | "returned"
  | "damaged"
  | "disposed"
  | "audited";

export interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  category: InventoryCategory;
  sku: string | null;
  unit: string;
  quantity: number;
  minimum_stock: number;
  unit_cost: number | null;
  location: string | null;
  condition: ItemCondition;
  supplier: string | null;
  last_audited: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  tx_type: TransactionType;
  quantity: number;
  balance_after: number;
  notes: string | null;
  reference: string | null;
  performed_by: string | null;
  created_at: string;
  inventory_items?: { name: string; unit: string } | null;
}

// ── Fees ──────────────────────────────────────────────────────────────────────

export type PaymentStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "waived";

export type PaymentMethod =
  | "mpesa"
  | "bank_transfer"
  | "cash"
  | "cheque"
  | "other";

export interface FeeStructure {
  id: string;
  class_id: string; // Refactored from grade: string
  term: number;
  academic_year: number;
  tuition_fee: number;
  activity_fee: number;
  lunch_fee: number;
  transport_fee: number;
  other_fee: number;
  notes: string | null;
  created_at: string;
  classes?: Class | null;
}

export interface FeePayment {
  id: string;
  student_id: string;
  fee_structure_id: string | null;
  term: number;
  academic_year: number;
  amount_due: number;
  amount_paid: number;
  status: PaymentStatus;
  payment_method: PaymentMethod | null;
  mpesa_code: string | null;
  paid_at: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  students?: {
    full_name: string;
    readable_id: string | null;
    class_id: string; // Refactored from current_grade
    classes?: Class | null;
  } | null;
  payment_date: string;
  reference_number: number;
  total_due: number;
}

// ── Attendance ────────────────────────────────────────────────────────────────

export type AttendanceStatus = "present" | "late" | "absent" | "excused";
export type AttendanceSession = "morning" | "afternoon" | "full_day";

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string; // Refactored from grade: string
  date: string;
  session: AttendanceSession;
  status: AttendanceStatus;
  notes: string | null;
  marked_by: string | null;
  created_at: string;
  updated_at: string;
  students?: {
    full_name: string;
    readable_id: string | null;
  } | null;
  classes?: Class | null;
}

export interface AttendanceGradeSummary {
  class_id: string; // Refactored from grade
  label: string;    // e.g. "Grade 4 North"
  total: number;    // students enrolled in that class
  marked: number;   // records found for this date
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;     // (present + late) / total * 100
}

export interface AttendanceOverview {
  date: string;
  totalStudents: number;
  totalMarked: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  presentRate: number;
  byClass: AttendanceGradeSummary[]; // Refactored from byGrade
  recentDays: { date: string; rate: number; marked: number }[];
}

// ── Shared ────────────────────────────────────────────────────────────────────

export interface StudentSummary {
  id: string;
  full_name: string;
  readable_id: string | null;
  class_id: string; // Refactored from current_grade
  classes?: Class | null;
}

export interface GovernanceStats {
  totalAnnouncements: number;
  upcomingEvents: number;
  lowStockItems: number;
  overduePayments: number;
  collectedThisTerm: number;
  outstandingFees: number;
  presentToday: number;
  absentToday: number;
  attendanceRate: number;
}