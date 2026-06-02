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

  // Guard: Ensure foundational session data layers exist safely
  if (!session || !session.user?.email || !session.user?.id || !session.profile) {
    redirect("/login");
  }

  const { base_role, is_dev, is_super_admin } = session.profile;

  // Master Bypass: Allow dev/super_admin overrides, otherwise restrict strictly to parents
  const hasAccess = base_role === "parent" || is_dev === true || is_super_admin === true;

  if (!hasAccess) {
    redirect("/login");
  }

  const _sp = await searchParams;
  const childParam = _sp?.child;

  // Fetch children tied to the parent email account
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