// app/admin/announcements/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import {
  fetchAnnouncementsAdmin,
  fetchEventsAdmin,
} from "@/lib/actions/engagement";
import { AdminEngagementClient } from "./EngagementPageClient";

// Import your existing components' exact prop interface shapes
import type { Announcement, SchoolEvent } from "../components/types";

export const metadata = { title: "Communications | Kibali Admin" };
export const revalidate = 0;

export default async function AdminAnnouncementsPage() {
  const session = await getSession();
  
  if (!session || !session.profile) {
    redirect("/login");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect the route using the updated BaseRole structural check
  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  // 1. Concurrent fetching
  const [rawAnnouncements, rawEvents] = await Promise.all([
    fetchAnnouncementsAdmin(),
    fetchEventsAdmin(),
  ]);

  // Use your real data interfaces for type-safe casting
  const announcements: Announcement[] = (rawAnnouncements ?? []) as unknown as Announcement[];
  const events: SchoolEvent[] = (rawEvents ?? []) as unknown as SchoolEvent[];

  return (
    <AdminEngagementClient 
      announcements={announcements} 
      events={events} 
    />
  );
}