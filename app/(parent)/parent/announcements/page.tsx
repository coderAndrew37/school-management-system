import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchMyChildren, fetchAllChildData } from "@/lib/data/parent";
import { ParentAnnouncementsClient } from "./ParentAnnouncementClient";

export const metadata = { title: "Notices | Kibali Parent Portal" };
export const revalidate = 0;

export default async function ParentAnnouncementsPage() {
  const session = await getSession();

  // Guard: Ensure session exists, role is parent, and email is present
  if (
    !session || 
    !session.user?.email || 
    session.profile.role !== "parent"
  ) {
    redirect("/login");
  }

  // Pass the session email to fix the toLowerCase() error
  const children = await fetchMyChildren(session.user.email);
  
  // If no children linked, send back to parent dashboard
  if (children.length === 0) {
    redirect("/parent");
  }

  /** * REFACTOR NOTE: 
   * We now use 'class_id' (the UUID) instead of 'current_grade' (text).
   * This aligns with the new schema constraints in public.classes.
   */
  const primaryChild = children[0];
  if (!primaryChild?.class_id) {
    redirect("/parent");
  }

  // Fetch all specific portal data for the primary child
  const childData = await fetchAllChildData(
    primaryChild.id,
    primaryChild.class_id,
    primaryChild.grade_label
  );

  return (
    <ParentAnnouncementsClient
      announcements={childData.announcements}
      events={childData.events}
    />
  );
}