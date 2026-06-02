// app/teacher/gallery/page.tsx

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchTeacherAssessmentAllocations,
  fetchClassStudents,
  type ClassStudent,
} from "@/lib/data/assessment";
import {
  fetchTeacherGallery,
  getSignedGalleryUrl,
} from "@/lib/actions/gallery";
import { getActiveTermYear } from "@/lib/utils/settings";
import GalleryClient from "./GalleryClient";
import type { ClassMetadata, GalleryItem } from "./gallery.types";

export const metadata = { title: "Learning Gallery | Kibali Teacher" };
export const revalidate = 0;

export default async function GalleryPage() {
  const supabase = await createSupabaseServerClient();

  // ── Access Control Guard ───────────────────────────────────────────────────
  const session = await getSession();
  if (!session || !session.profile) {
    redirect("/login");
  }

  const { base_role, is_super_admin, is_dev, full_name, id: teacherId } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect route with structural check for staff (teachers) and administrator overrides
  if (base_role !== "staff" && base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  // Get current school year from settings
  const { academicYear } = await getActiveTermYear();

  // 1. Get all allocations for this teacher to identify their classes
  const allocations = await fetchTeacherAssessmentAllocations(
    teacherId,
    academicYear,
  );

  // 2. Fetch the actual class metadata for these allocations to get UUIDs, Grades, and Streams
  const uniqueClassIds = [...new Set(allocations.map((a) => a.classId))];
  
  const { data: classData } = await supabase
    .from("classes")
    .select("id, grade, stream, level, academic_year")
    .in("id", uniqueClassIds)
    .order("grade", { ascending: true });

  const classes: ClassMetadata[] = (classData || []) as ClassMetadata[];

  // 3. Fetch students for each class UUID and store them in a Record
  const studentsByClass: Record<string, ClassStudent[]> = {};

  await Promise.all(
    classes.map(async (cls) => {
      const students = await fetchClassStudents(cls.id);
      studentsByClass[cls.id] = students;
    })
  );

  // 4. Fetch gallery items and hydrate with temporary signed URLs
  const rawItems = await fetchTeacherGallery(teacherId, 80);
  const galleryItems: GalleryItem[] = await Promise.all(
    rawItems.map(async (item) => ({
      ...item,
      signedUrl: (await getSignedGalleryUrl(item.media_url, 3600)) ?? "",
    })),
  );

  // 5. Build a flat student name lookup map for the UI grid/lightbox
  const studentNameMap: Record<string, string> = {};
  Object.values(studentsByClass)
    .flat()
    .forEach((s) => {
      studentNameMap[s.id] = s.full_name;
    });

  return (
    <GalleryClient
      teacherName={full_name ?? ""}
      teacherId={teacherId}
      classes={classes}
      studentsByClass={studentsByClass}
      studentNameMap={studentNameMap}
      initialItems={galleryItems}
      academicYear={academicYear}
    />
  );
}