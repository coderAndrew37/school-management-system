import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { MessagesPageClient } from "./MessagesPageClient";

export const metadata = { title: "Messages | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function MessagesPage({ searchParams }: PageProps) {
  const session = await getSession();

  // Guard: Ensure session, email, and ID exist
  if (
    !session || 
    !session.user?.email || 
    !session.user?.id || 
    session.profile.role !== "parent"
  ) {
    redirect("/login");
  }

  const _sp = await searchParams;
  const childParam = _sp?.child;

  // Fix: Pass session email to fetchMyChildren
  const children = await fetchMyChildren(session.user.email);
  if (children.length === 0) redirect("/parent");

  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;

  /**
   * REFACTOR: Use 'class_id' (UUID) instead of 'current_grade'
   * This ensures messaging threads are pulled for the correct class context.
   */
  if (!activeChild.class_id) redirect("/parent");

  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.class_id,
    activeChild.grade_label
  );

  return (
    <MessagesPageClient
      messages={childData.messages}
      child={activeChild}
      allChildren={children}
      parentId={session.user.id}
    />
  );
}