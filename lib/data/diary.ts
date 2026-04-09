// lib/data/diary.ts
// Server-side data fetching for the diary page.
// Maps raw Supabase rows to the typed TeacherDiaryEntry union using class_id logic.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  ClassDiaryEntry,
  ObservationEntry,
  TeacherDiaryEntry,
} from "@/lib/types/diary";

// ── 1. Raw DB row shapes ──────────────────────────────────────────────────────

interface ClassRow {
  id: string;
  entry_type: string;
  class_id: string | null;
  title: string;
  subject_name: string | null;
  content: string | null;
  due_date: string | null;
  is_completed: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ObsRow {
  id: string;
  entry_type: string;
  class_id: string | null;
  student_id: string;
  title: string;
  subject_name: string | null;
  content: string | null;
  is_completed: boolean | null;
  created_at: string;
  updated_at: string;
  students: { full_name: string } | null;
}

// ── 2. Mapper helpers ────────────────────────────────────────────────────────────

function toClassEntry(r: ClassRow): ClassDiaryEntry {
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
    due_date: r.due_date ?? null,
    is_completed: r.is_completed ?? false,
  };
}

function toObsEntry(r: ObsRow): ObservationEntry {
  return {
    id: r.id,
    // ObservationEntry interface requires null for class_id 
    // to separate it from class-wide notices/homework.
    class_id: null, 
    entry_type: "observation",
    title: r.title,
    subject_name: r.subject_name ?? "General",
    content: r.content,
    diary_date: r.created_at.slice(0, 10),
    created_at: r.created_at,
    updated_at: r.updated_at,
    student_id: r.student_id,
    due_date: null,
    is_completed: false, // Per ObservationEntry interface requirement
  };
}

// ── 3. Public API ──────────────────────────────────────────────────────────────

/**
 * Fetches diary entries based on class_ids.
 */
export async function fetchTeacherDiaryEntries(
  classIds: string[],
  limit = 60,
): Promise<TeacherDiaryEntry[]> {
  if (classIds.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const half = Math.ceil(limit / 2);

  const [classRes, obsRes] = await Promise.all([
    supabase
      .from("student_diary")
      .select("id, entry_type, class_id, title, subject_name, content, due_date, is_completed, created_at, updated_at")
      .in("class_id", classIds)
      .in("entry_type", ["homework", "notice"])
      .is("student_id", null)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<ClassRow[]>(),

    supabase
      .from("student_diary")
      .select(`
        id, entry_type, class_id, student_id, title, subject_name, content, is_completed, created_at, updated_at,
        students!inner ( full_name )
      `)
      .in("class_id", classIds)
      .eq("entry_type", "observation")
      .order("created_at", { ascending: false })
      .limit(half)
      .returns<ObsRow[]>(),
  ]);

  if (classRes.error) console.error("[fetchTeacherDiary] class:", classRes.error.message);
  if (obsRes.error) console.error("[fetchTeacherDiary] obs:", obsRes.error.message);

  const entries: TeacherDiaryEntry[] = [
    ...(classRes.data ?? []).map(toClassEntry),
    ...(obsRes.data ?? []).map(toObsEntry),
  ];

  return entries.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

// ── 4. Fetch available grades/streams from the classes table ──────────────────

export interface ClassOption {
  id: string;
  grade: string;
  stream: string;
  academicYear: number;
  label: string; 
}

export async function fetchClassOptions(
  academicYear: number,
): Promise<ClassOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, grade, stream, academic_year")
    .eq("academic_year", academicYear)
    .order("grade")
    .returns<
      { id: string; grade: string; stream: string; academic_year: number }[]
    >();

  if (error) {
    console.error("[fetchClassOptions]", error.message);
    return [];
  }
  
  return (data ?? []).map((c) => ({
    id: c.id,
    grade: c.grade,
    stream: c.stream,
    academicYear: c.academic_year,
    label: c.stream && c.stream !== "Main" ? `${c.grade} — ${c.stream}` : c.grade,
  }));
}