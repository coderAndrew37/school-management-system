import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CommunicationLogEntry,
  RecipientsPayload,
  SendChannel,
  SingleRecipient,
} from "@/lib/types/communications";

// ── 1. Raw DB Row Shapes ─────────────────────────────────────────────────────────

// Refactored to represent unified data fields coming from the profiles table
type ProfileRecipientRow = {
  id: string;
  full_name: string;
  email: string | null;
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

// ── 2. Type-Safe Mappers ──────────────────────────────────────────────────────────

function mapProfileRecipient(row: ProfileRecipientRow): SingleRecipient {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email ?? "", // Fallback empty string if email missing in profile record
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

// ── 3. Public Multi-Tenant API ──────────────────────────────────────────────────

/**
 * Fetches all possible communication targets inside a single school tenant instance.
 * Resolves both teachers and parents out of the unified profiles table.
 */
export async function fetchCommunicationRecipients(schoolId: string): Promise<RecipientsPayload> {
  const supabase = await createSupabaseServerClient();

  const [teachersResult, parentsResult, gradesResult] = await Promise.all([
    // FIXED: Query teachers from profiles table directly using base_role to get full_name
    supabase
      .from("profiles")
      .select("id, full_name, email, phone_number")
      .eq("base_role", "teacher")
      .eq("school_id", schoolId)
      .order("full_name", { ascending: true })
      .returns<ProfileRecipientRow[]>(),

    // Query parents using base_role field configuration
    supabase
      .from("profiles")
      .select("id, full_name, email, phone_number")
      .eq("base_role", "parent")
      .eq("school_id", schoolId)
      .order("full_name", { ascending: true })
      .returns<ProfileRecipientRow[]>(),

    // Gather existing grades configured inside this specific campus environment
    supabase
      .from("students")
      .select("current_grade")
      .eq("school_id", schoolId)
      .order("current_grade", { ascending: true })
      .returns<StudentGradeRow[]>(),
  ]);

  if (teachersResult.error) console.error("[fetchCommunicationRecipients] Teachers Error:", teachersResult.error.message);
  if (parentsResult.error) console.error("[fetchCommunicationRecipients] Parents Error:", parentsResult.error.message);
  if (gradesResult.error) console.error("[fetchCommunicationRecipients] Grades Error:", gradesResult.error.message);

  // Eliminate duplicate values and sort chronologically/alphabetically
  const grades = [
    ...new Set((gradesResult.data ?? []).map((r) => r.current_grade)),
  ].sort();

  return {
    teachers: (teachersResult.data ?? []).map(mapProfileRecipient),
    parents: (parentsResult.data ?? []).map(mapProfileRecipient),
    grades,
  };
}

/**
 * Fetches historical outbound communications log entries for a single institution context.
 */
export async function fetchCommunicationsLog(schoolId: string): Promise<CommunicationLogEntry[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("communications_log")
    .select(
      `id, audience_type, audience_label, subject,
       body_preview, recipient_count, status,
       channel, scheduled_at, sent_at, created_at,
       profiles ( full_name )`,
    )
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<LogRow[]>();

  if (error) {
    console.error("[fetchCommunicationsLog] Error:", error.message);
    return [];
  }

  return (data ?? []).map(mapLogEntry);
}