// app/admin/events/page.tsx
// Events are managed inside the AdminEngagementClient alongside announcements.
// This page simply redirects to /admin/announcements with the events tab pre-selected.
import { redirect } from "next/navigation";

export default function AdminEventsPage() {
  redirect("/admin/announcements?tab=events");
}
