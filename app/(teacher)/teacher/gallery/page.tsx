// app/teacher/gallery/page.tsx

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
} from "@/lib/data/assessment";
import {
  fetchTeacherGallery,
  getSignedGalleryUrl,
} from "@/lib/actions/gallery";
import { getActiveTermYear } from "@/lib/utils/settings";
import GalleryClient from "./GalleryClient";

export const metadata = { title: "Learning Gallery | Kibali Teacher" };
export const revalidate = 0;

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

  // Use school settings for year — no more hardcoded 2026
  const { academicYear } = await getActiveTermYear();

  const allocations = await fetchTeacherAssessmentAllocations(
    teacher.id,
    academicYear,
  );
  const uniqueGrades = [...new Set(allocations.map((a) => a.grade))].sort();

  // Fetch students for each grade in parallel
  const studentsByGrade: Record<
    string,
    Awaited<ReturnType<typeof fetchClassStudents>>
  > = {};
  await Promise.all(
    uniqueGrades.map(async (grade) => {
      studentsByGrade[grade] = await fetchClassStudents(grade);
    }),
  );

  // Fetch gallery + hydrate signed URLs in parallel
  const rawItems = await fetchTeacherGallery(teacher.id, 80);
  const galleryItems = await Promise.all(
    rawItems.map(async (item) => ({
      ...item,
      signedUrl: (await getSignedGalleryUrl(item.media_url, 3600)) ?? "",
    })),
  );

  // Student name lookup map
  const studentNameMap: Record<string, string> = {};
  for (const students of Object.values(studentsByGrade))
    for (const s of students) studentNameMap[s.id] = s.full_name;

  return (
    <GalleryClient
      teacherName={teacher.full_name}
      teacherId={teacher.id}
      grades={uniqueGrades}
      studentsByGrade={studentsByGrade}
      studentNameMap={studentNameMap}
      initialItems={galleryItems}
      academicYear={academicYear}
    />
  );
}
