// app/admin/announcements/page.tsx
// Combined admin publisher for announcements + events.
// Route also handles /admin/events via the tab toggle inside the client.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import {
  fetchAnnouncementsAdmin,
  fetchEventsAdmin,
} from "@/lib/actions/engagement";
import { AdminEngagementClient } from "./EngagementPageClient";

export const metadata = { title: "Communications | Kibali Admin" };
export const revalidate = 0;

export default async function AdminAnnouncementsPage() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }

  const [announcements, events] = await Promise.all([
    fetchAnnouncementsAdmin(),
    fetchEventsAdmin(),
  ]);

  return (
    <AdminEngagementClient announcements={announcements} events={events} />
  );
}
