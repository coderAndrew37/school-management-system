import { notFound } from "next/navigation";
import { getActiveTermYear } from "@/lib/utils/settings";
import { TeacherDetailClient } from "@/app/_components/teachers/TeacherDetailClient";
import {
  fetchTeacherByStaffId,
  fetchTeacherStats,
  fetchClassTeacherAssignments, // Corrected name
  fetchTeacherAllocations,
} from "@/lib/data/teachers";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ staff_id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { staff_id } = await params;
  return { title: `${staff_id} | Kibali Staff` };
}

export default async function TeacherDetailPage({ params }: Props) {
  const { staff_id } = await params;
  const { academicYear, term } = await getActiveTermYear();

  const teacher = await fetchTeacherByStaffId(staff_id);
  if (!teacher) notFound();

  // We fetch assignments (which includes history/active status) instead of just grades
  const [allocations, stats, classAssignments] = await Promise.all([
    fetchTeacherAllocations(teacher.id, academicYear),
    fetchTeacherStats(teacher.id, academicYear),
    fetchClassTeacherAssignments(teacher.id, academicYear), // Corrected function call
  ]);

  return (
    <TeacherDetailClient
      teacher={teacher}
      allocations={allocations}
      stats={stats}
      classAssignments={classAssignments} // Updated prop name to match logic
      academicYear={academicYear}
      term={term}
    />
  );
}
