// lib/data/parent-diary-fetcher.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ClassDiaryEntry,
  ObservationEntry,
  TeacherDiaryEntry,
} from "../types/diary";

// ── 1. Raw DB row shapes ──────────────────────────────────────────────────────

interface RawDiaryRow {
  id: string;
  entry_type: string;
  class_id: string | null;
  student_id: string | null;
  title: string;
  subject_name: string | null;
  content: string | null;
  due_date: string | null;
  is_completed: boolean | null;
  created_at: string;
  updated_at: string;
}

// ── 2. Mapper helpers ──────────────────────────────────────────────────────────

function mapToClassEntry(r: RawDiaryRow): ClassDiaryEntry {
  return {
    id: r.id,
    class_id: r.class_id ?? "",
    entry_type: r.entry_type as "homework" | "notice",
    title: r.title,
    subject_name: r.subject_name ?? "General",
    content: r.content,
    diary_date: r.created_at.slice(0, 10),
    created_at: r.created_at,
    updated_at: r.updated_at,
    student_id: null,
    due_date: r.due_date,
    is_completed: !!r.is_completed,
  };
}

function mapToObservation(r: RawDiaryRow): ObservationEntry {
  return {
    id: r.id,
    class_id: null, // Strictly null for observations
    entry_type: "observation",
    title: r.title,
    subject_name: r.subject_name ?? "General",
    content: r.content,
    diary_date: r.created_at.slice(0, 10),
    created_at: r.created_at,
    updated_at: r.updated_at,
    student_id: r.student_id ?? "",
    due_date: null,
    is_completed: false,
  };
}

// ── 3. Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch diary entries visible to a parent for a given child.
 */
export async function fetchParentDiaryFeed(
  childId: string,
  childClassId: string, // Changed from childGrade
  limit = 40,
): Promise<TeacherDiaryEntry[]> {
  const supabase = await createSupabaseServerClient();

  const [classRes, obsRes] = await Promise.all([
    // Class-wide: homework and notices for the specific stream
    supabase
      .from("student_diary")
      .select("id, entry_type, class_id, title, subject_name, content, due_date, is_completed, created_at, updated_at")
      .eq("class_id", childClassId)
      .in("entry_type", ["homework", "notice"])
      .is("student_id", null)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<RawDiaryRow[]>(),

    // Individual: private observations for this specific child
    supabase
      .from("student_diary")
      .select("id, entry_type, class_id, student_id, title, subject_name, content, is_completed, created_at, updated_at")
      .eq("student_id", childId)
      .eq("entry_type", "observation")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<RawDiaryRow[]>(),
  ]);

  const classEntries = (classRes.data ?? []).map(mapToClassEntry);
  const obsEntries = (obsRes.data ?? []).map(mapToObservation);

  return [...classEntries, ...obsEntries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Convenience: separate buckets for structured parent UI rendering.
 */
export async function fetchParentDiaryBuckets(
  childId: string,
  childClassId: string,
) {
  const all = await fetchParentDiaryFeed(childId, childClassId);
  
  return {
    homework: all.filter((e) => e.entry_type === "homework") as ClassDiaryEntry[],
    notices: all.filter((e) => e.entry_type === "notice") as ClassDiaryEntry[],
    observations: all.filter((e) => e.entry_type === "observation") as ObservationEntry[],
  };
}