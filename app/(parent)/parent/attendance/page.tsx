import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { AttendancePageClient } from "./AttendanceClient";

export const metadata = { title: "Attendance | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const session = await getSession();

  // Guard: Ensure session and user email exist
  if (!session || !session.user?.email || session.profile.role !== "parent") {
    redirect("/login");
  }

  const _sp = await searchParams;
  const childParam = _sp?.child;

  // Pass session email to the fetcher to avoid toLowerCase() error
  const children = await fetchMyChildren(session.user.email);
  if (children.length === 0) redirect("/parent");

  // Find the selected child or default to the first one
  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;

  /**
   * REFACTOR: Ensure 'class_id' is used instead of 'current_grade'
   * This matches the schema constraints for fetching attendance records.
   */
  if (!activeChild.class_id) redirect("/parent");

  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.class_id,
    activeChild.grade_label
  );

  return (
    <AttendancePageClient
      attendance={childData.attendance}
      child={activeChild}
      allChildren={children}
    />
  );
}