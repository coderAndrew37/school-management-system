// app/parent/events/page.tsx
// Events are part of the announcements page — redirect with tab param.
import { redirect } from "next/navigation";

export default function ParentEventsPage() {
  redirect("/parent/announcements?tab=calendar");
}
