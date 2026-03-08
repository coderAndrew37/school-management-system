import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
} from "@/lib/data/assessment";
import {
  fetchTeacherGallery,
  getSignedGalleryUrl,
} from "@/lib/actions/gallery";
import GalleryClient from "./GalleryClient";
import { redirect } from "next/navigation";

export default async function GalleryPage() {
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

  // Fetch teacher's gallery and hydrate signed URLs
  const rawItems = await fetchTeacherGallery(teacher.id, 80);

  const galleryItems = await Promise.all(
    rawItems.map(async (item) => {
      const signedUrl = await getSignedGalleryUrl(item.media_url, 3600);
      return { ...item, signedUrl: signedUrl ?? "" };
    }),
  );

  // Build student name map for display
  const studentNameMap: Record<string, string> = {};
  for (const [, students] of Object.entries(studentsByGrade)) {
    for (const s of students) {
      studentNameMap[s.id] = s.full_name;
    }
  }

  return (
    <GalleryClient
      teacherName={teacher.full_name}
      teacherId={teacher.id}
      grades={uniqueGrades}
      studentsByGrade={studentsByGrade}
      studentNameMap={studentNameMap}
      initialItems={galleryItems}
    />
  );
}
