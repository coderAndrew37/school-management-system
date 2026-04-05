import { notFound } from "next/navigation";
import { getActiveTermYear } from "@/lib/utils/settings";
import { TeacherDetailClient } from "@/app/_components/teachers/TeacherDetailClient";
// Updated import name here
import {
  fetchTeacherByStaffId,
  fetchTeacherStats,
  fetchClassTeacherGrades,
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

  const [allocations, stats, classGrades] = await Promise.all([
    // Updated function call here
    fetchTeacherAllocations(teacher.id, academicYear),
    fetchTeacherStats(teacher.id, academicYear),
    fetchClassTeacherGrades(teacher.id, academicYear),
  ]);

  return (
    <TeacherDetailClient
      teacher={teacher}
      allocations={allocations}
      stats={stats}
      classGrades={classGrades}
      academicYear={academicYear}
      term={term}
    />
  );
}
