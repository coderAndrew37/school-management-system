// app/parent/fees/page.tsx
import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { FeesPageClient } from "./FeesPageClient";

export const metadata = { title: "Fees | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function FeesPage({ searchParams }: PageProps) {
  const session = await getSession();

  // Guard: Ensure session, profile, and user email exist
  if (!session || !session.profile || !session.user?.email) {
    redirect("/login");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect the route using the updated BaseRole structural check for parents
  if (base_role !== "parent" && !isPlatformAdmin) {
    redirect("/login");
  }

  const _sp = await searchParams;
  const childParam = _sp?.child;

  // Pass session email to fetchMyChildren
  const children = await fetchMyChildren(session.user.email);
  if (children.length === 0) redirect("/parent");

  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;

  /**
   * REFACTOR: Use 'class_id' instead of 'current_grade'
   * This ensures the fee records are scoped correctly to the student's current class UUID.
   */
  if (!activeChild.class_id) redirect("/parent");

  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.class_id,
    activeChild.grade_label
  );

  return (
    <FeesPageClient
      feePayments={childData.feePayments}
      child={activeChild}
      allChildren={children}
    />
  );
}