import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { DiaryPageClient } from "./DiaryPageClient";

export const metadata = { title: "Diary | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function DiaryPage({ searchParams }: PageProps) {
  const session = await getSession();

  // Guard: Ensure session and email exist
  if (!session || !session.user?.email || session.profile.role !== "parent") {
    redirect("/login");
  }

  const _sp = await searchParams;
  const childParam = _sp?.child;

  // Pass session email to prevent 'toLowerCase' runtime error
  const children = await fetchMyChildren(session.user.email);
  if (children.length === 0) redirect("/parent");

  // Determine which child is being viewed
  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;

  /**
   * REFACTOR: fetchAllChildData signature update
   * Argument 2 must be the 'class_id' (UUID) to fetch the diary feed correctly.
   */
  if (!activeChild.class_id) redirect("/parent");

  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.class_id,
    activeChild.grade_label
  );

  return (
    <DiaryPageClient
      diary={childData.diary}
      child={activeChild}
      allChildren={children}
    />
  );
}