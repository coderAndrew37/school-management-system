// app/parent/announcements/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchMyChildren, fetchAllChildData } from "@/lib/data/parent";
import { ParentAnnouncementsClient } from "./ParentAnnouncementClient";

export const metadata = { title: "Notices | Kibali Parent Portal" };
export const revalidate = 0;

export default async function ParentAnnouncementsPage() {
  const session = await getSession();
  if (!session || session.profile.role !== "parent") redirect("/login");

  const children = await fetchMyChildren();
  if (children.length === 0) redirect("/parent");

  // Announcements are not per-child — fetch from first child's data
  const childData = await fetchAllChildData(
    children[0]!.id,
    children[0]!.current_grade,
  );

  return (
    <ParentAnnouncementsClient
      announcements={childData.announcements}
      events={childData.events}
    />
  );
}
