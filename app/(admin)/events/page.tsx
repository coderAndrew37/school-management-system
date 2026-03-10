// app/admin/events/page.tsx
// Redirects to the announcements page which contains the events tab.
// The AdminEngagementClient manages both tabs client-side.
import { redirect } from "next/navigation";

export default function AdminEventsPage() {
  redirect("/announcements?tab=events");
}
