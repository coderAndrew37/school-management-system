// lib/data/parent-diary-fetcher.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ClassDiaryEntry,
  ObservationEntry,
  TeacherDiaryEntry,
} from "../types/diary";

/**
 * Fetch diary entries visible to a parent for a given child.
 */
export async function fetchParentDiaryFeed(
  childId: string,
  childGrade: string,
  limit = 40,
): Promise<TeacherDiaryEntry[]> {
  const supabase = await createSupabaseServerClient();

  const [classRes, obsRes] = await Promise.all([
    supabase
      .from("student_diary")
      .select(
        "id, entry_type, grade, title, content, due_date, is_completed, created_at",
      )
      .eq("grade", childGrade)
      .in("entry_type", ["homework", "notice"])
      .is("student_id", null)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("student_diary")
      .select(
        "id, entry_type, grade, student_id, title, content, is_completed, created_at",
      )
      .eq("student_id", childId)
      .eq("entry_type", "observation")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  // 1. Map Class Entries: Must explicitly add student_id: null
  const classResult: ClassDiaryEntry[] = (classRes.data ?? []).map(
    (r: any) => ({
      id: r.id,
      grade: r.grade,
      entry_type: r.entry_type as "homework" | "notice",
      title: r.title,
      content: r.content,
      // Add missing required properties for DiaryBase
      body: r.content,
      diary_date: r.created_at?.slice(0, 10) || "",
      created_at: r.created_at,
      student_id: null,
      due_date: r.due_date,
      is_completed: !!r.is_completed,
      homework: r.entry_type === "homework" ? r.content : null,
    }),
  );

  // 2. Map Observations: Must explicitly add due_date: null and is_completed: false
  const obsResult: ObservationEntry[] = (obsRes.data ?? []).map((r: any) => ({
    id: r.id,
    grade: r.grade,
    entry_type: "observation" as const,
    title: r.title,
    content: r.content,
    // Add missing required properties for DiaryBase
    body: r.content,
    diary_date: r.created_at?.slice(0, 10) || "",
    created_at: r.created_at,
    student_id: r.student_id,
    student_name: "", // Usually updated via child profile in parent view
    due_date: null,
    is_completed: false,
  }));

  return [...classResult, ...obsResult].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Convenience: separate buckets for structured parent UI rendering.
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
