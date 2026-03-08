// app/teacher/messages/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
} from "@/lib/data/assessment";
import MessagesClient from "./MessagesClient";
import { redirect } from "next/navigation";

interface RecentMessage {
  id: string;
  student_id: string;
  student_name: string;
  grade: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, full_name")
    .eq("id", user.id)
    .single();

  if (!teacher) redirect("/login");

  const allocations = await fetchTeacherAssessmentAllocations(teacher.id, 2026);
  const uniqueGrades = [...new Set(allocations.map((a) => a.grade))].sort();

  const studentsByGrade: Record<
    string,
    Awaited<ReturnType<typeof fetchClassStudents>>
  > = {};
  await Promise.all(
    uniqueGrades.map(async (grade) => {
      studentsByGrade[grade] = await fetchClassStudents(grade);
    }),
  );

  // Fetch recent notifications sent to students in teacher's classes
  const allStudentIds = Object.values(studentsByGrade)
    .flat()
    .map((s) => s.id);

  let recentMessages: RecentMessage[] = [];
  if (allStudentIds.length > 0) {
    const { data: notifs } = await supabase
      .from("notifications")
      .select("id, student_id, title, body, type, is_read, created_at")
      .in("student_id", allStudentIds)
      .order("created_at", { ascending: false })
      .limit(40);

    // Build student name map
    const studentMap: Record<string, { name: string; grade: string }> = {};
    for (const [grade, students] of Object.entries(studentsByGrade)) {
      for (const s of students) {
        studentMap[s.id] = { name: s.full_name, grade };
      }
    }

    recentMessages = (notifs ?? []).map((n) => ({
      id: n.id,
      student_id: n.student_id,
      student_name: studentMap[n.student_id]?.name ?? "Unknown",
      grade: studentMap[n.student_id]?.grade ?? "—",
      title: n.title,
      body: n.body,
      type: n.type,
      is_read: n.is_read,
      created_at: n.created_at,
    }));
  }

  return (
    <MessagesClient
      teacherName={teacher.full_name}
      grades={uniqueGrades}
      studentsByGrade={studentsByGrade}
      recentMessages={recentMessages}
    />
  );
}
