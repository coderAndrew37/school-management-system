// lib/data/diary.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  TeacherDiaryEntry,
  ClassDiaryEntry,
  ObservationEntry,
} from "../types/diary";

/**
 * Fetch all diary entries (Homework, Notices, Observations) for a teacher.
 * Filters by the grades the teacher is allocated to.
 */
export async function fetchTeacherDiaryEntries(
  grades: string[],
  limit = 60,
): Promise<TeacherDiaryEntry[]> {
  if (grades.length === 0) return [];
  const supabase = await createSupabaseServerClient();

  // 1. Fetch Class-wide entries (Homework/Notices) for these grades
  const { data: classEntries, error: classError } = await supabase
    .from("student_diary")
    .select(
      "id, entry_type, grade, title, content, due_date, is_completed, created_at",
    )
    .in("grade", grades)
    .in("entry_type", ["homework", "notice"])
    .is("student_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (classError)
    console.error("[fetchTeacherDiary] class error:", classError.message);

  // 2. Fetch Student-specific observations for these grades
  const { data: obsEntries, error: obsError } = await supabase
    .from("student_diary")
    .select(
      `
      id, entry_type, grade, student_id, title, content, is_completed, created_at,
      students!inner ( full_name )
    `,
    )
    .in("grade", grades)
    .eq("entry_type", "observation")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (obsError)
    console.error("[fetchTeacherDiary] obs error:", obsError.message);

  // 3. Map to our unified TeacherDiaryEntry type
  const mappedClass: ClassDiaryEntry[] = (classEntries ?? []).map((r) => ({
    id: r.id,
    entry_type: r.entry_type as "homework" | "notice",
    grade: r.grade,
    title: r.title,
    content: r.content,
    due_date: r.due_date,
    is_completed: !!r.is_completed,
    created_at: r.created_at,
  }));

  const mappedObs: ObservationEntry[] = (obsEntries ?? []).map((r: any) => ({
    id: r.id,
    entry_type: "observation",
    grade: r.grade,
    student_id: r.student_id,
    student_name: r.students?.full_name ?? "Unknown Student",
    title: r.title,
    content: r.content,
    is_completed: !!r.is_completed,
    created_at: r.created_at,
  }));

  // Combine and sort by date
  return [...mappedClass, ...mappedObs].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
