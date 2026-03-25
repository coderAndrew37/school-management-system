// lib/data/parent.ts  — diary section
// Add this function to your parent data fetching module.
// The query is the key piece: class-wide entries (student_id IS NULL)
// AND personal observations for this child specifically.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ClassDiaryEntry,
  ObservationEntry,
  TeacherDiaryEntry,
} from "../types/diary";

/**
 * Fetch diary entries visible to a parent for a given child.
 *
 * Returns:
 *  - All homework + notice entries for the child's grade (student_id IS NULL)
 *  - All observations written specifically for this child (student_id = childId)
 *
 * This is the "digital correspondence book" the parent sees:
 *  one teacher writes → all parents in the grade see class-wide entries
 *  one teacher writes → only this parent sees their child's observations
 */
export async function fetchParentDiaryFeed(
  childId: string,
  childGrade: string,
  limit = 40,
): Promise<TeacherDiaryEntry[]> {
  const supabase = await createSupabaseServerClient();

  // Class-wide entries: homework and notices for this grade
  const { data: classEntries, error: classError } = await supabase
    .from("student_diary")
    .select(
      "id, entry_type, grade, title, content, due_date, is_completed, created_at",
    )
    .eq("grade", childGrade)
    .in("entry_type", ["homework", "notice"])
    .is("student_id", null) // explicitly class-wide
    .order("created_at", { ascending: false })
    .limit(limit);

  if (classError)
    console.error("[fetchParentDiaryFeed] class:", classError.message);

  // Personal observations for this specific child
  const { data: obsEntries, error: obsError } = await supabase
    .from("student_diary")
    .select(
      "id, entry_type, grade, student_id, title, content, is_completed, created_at",
    )
    .eq("student_id", childId)
    .eq("entry_type", "observation")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (obsError) console.error("[fetchParentDiaryFeed] obs:", obsError.message);

  const classResult: ClassDiaryEntry[] = (classEntries ?? []).map((r: any) => ({
    id: r.id,
    entry_type: r.entry_type as "homework" | "notice",
    grade: r.grade,
    title: r.title,
    content: r.content,
    due_date: r.due_date,
    is_completed: r.is_completed,
    created_at: r.created_at,
  }));

  const obsResult: ObservationEntry[] = (obsEntries ?? []).map((r: any) => ({
    id: r.id,
    entry_type: "observation" as const,
    grade: r.grade,
    student_id: r.student_id,
    student_name: "", // parent already knows their child's name
    title: r.title,
    content: r.content,
    is_completed: r.is_completed,
    created_at: r.created_at,
  }));

  // Merge sorted by date
  return [...classResult, ...obsResult].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Convenience: separate buckets for structured parent UI rendering.
 * homework → action items with due dates
 * notices  → announcements feed
 * observations → learning portrait / character narrative
 */
export async function fetchParentDiaryBuckets(
  childId: string,
  childGrade: string,
) {
  const all = await fetchParentDiaryFeed(childId, childGrade);
  return {
    homework: all.filter(
      (e) => e.entry_type === "homework",
    ) as ClassDiaryEntry[],
    notices: all.filter((e) => e.entry_type === "notice") as ClassDiaryEntry[],
    observations: all.filter(
      (e) => e.entry_type === "observation",
    ) as ObservationEntry[],
  };
}
