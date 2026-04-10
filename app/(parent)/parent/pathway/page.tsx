import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { PathwayPageClient } from "./PathwayPageClient";

export const metadata = { title: "JSS Pathway | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function PathwayPage({ searchParams }: PageProps) {
  const session = await getSession();

  // Guard: Ensure session and user email exist
  if (!session || !session.user?.email || session.profile.role !== "parent") {
    redirect("/login");
  }

  const _sp = await searchParams;
  const childParam = _sp?.child;

  // Fix: Pass session email to fetchMyChildren to resolve TS error
  const children = await fetchMyChildren(session.user.email);
  if (children.length === 0) redirect("/parent");

  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;

  /**
   * REFACTOR: Use 'class_id' (UUID) instead of 'current_grade'
   * This ensures JSS pathway data is pulled for the correct academic class.
   */
  if (!activeChild.class_id) redirect("/parent");

  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.class_id,
    activeChild.grade_label
  );

  return (
    <PathwayPageClient
      pathway={childData.pathway}
      child={activeChild}
      allChildren={children}
    />
  );
}