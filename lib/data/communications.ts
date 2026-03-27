import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CommunicationLogEntry,
  RecipientsPayload,
  SendChannel,
  SingleRecipient,
} from "@/lib/types/communications";

// ── Raw DB row shapes ─────────────────────────────────────────────────────────

type TeacherRow = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
};

type ParentRow = {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
};

type StudentGradeRow = {
  current_grade: string;
};

type LogRow = {
  id: string;
  audience_type: string;
  audience_label: string;
  subject: string;
  body_preview: string;
  recipient_count: number;
  status: string;
  channel: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  profiles: { full_name: string } | null;
};

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapTeacher(row: TeacherRow): SingleRecipient {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone_number: row.phone_number,
  };
}

function mapParent(row: ParentRow): SingleRecipient {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone_number: row.phone_number,
  };
}

function mapLogEntry(row: LogRow): CommunicationLogEntry {
  return {
    id: row.id,
    audience_type: row.audience_type as CommunicationLogEntry["audience_type"],
    audience_label: row.audience_label,
    subject: row.subject,
    body_preview: row.body_preview,
    recipient_count: row.recipient_count,
    status: row.status as CommunicationLogEntry["status"],
    channel: row.channel as SendChannel,
    scheduled_at: row.scheduled_at,
    sent_at: row.sent_at,
    created_at: row.created_at,
    sent_by_name: row.profiles?.full_name ?? "Admin",
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchCommunicationRecipients(): Promise<RecipientsPayload> {
  const supabase = await createSupabaseServerClient();

  const [teachersResult, parentsResult, gradesResult] = await Promise.all([
    supabase
      .from("teachers")
      .select("id, full_name, email, phone_number")
      .order("full_name", { ascending: true })
      .returns<TeacherRow[]>(),

    supabase
      .from("parents")
      .select("id, full_name, email, phone_number")
      .order("full_name", { ascending: true })
      .returns<ParentRow[]>(),

    supabase
      .from("students")
      .select("current_grade")
      .order("current_grade", { ascending: true })
      .returns<StudentGradeRow[]>(),
  ]);

  if (teachersResult.error)
    console.error("fetchTeachers error:", teachersResult.error);
  if (parentsResult.error)
    console.error("fetchParents error:", parentsResult.error);
  if (gradesResult.error)
    console.error("fetchGrades error:", gradesResult.error);

  const grades = [
    ...new Set((gradesResult.data ?? []).map((r) => r.current_grade)),
  ].sort();

  return {
    teachers: (teachersResult.data ?? []).map(mapTeacher),
    parents: (parentsResult.data ?? []).map(mapParent),
    grades,
  };
}

export async function fetchCommunicationsLog(): Promise<
  CommunicationLogEntry[]
> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("communications_log")
    .select(
      `id, audience_type, audience_label, subject,
       body_preview, recipient_count, status,
       channel, scheduled_at, sent_at, created_at,
       profiles ( full_name )`,
    )
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<LogRow[]>();

  if (error) {
    console.error("fetchCommunicationsLog error:", error);
    return [];
  }

  return (data ?? []).map(mapLogEntry);
}
