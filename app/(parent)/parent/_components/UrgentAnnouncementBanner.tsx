import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { Announcement } from "@/lib/types/governance";

interface Props {
  announcement: Announcement;
}

export function UrgentAnnouncementBanner({ announcement }: Props) {
  return (
    <div className="bg-rose-500 text-white px-4 py-2.5 flex items-center gap-2">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <p className="text-xs font-bold flex-1 line-clamp-1">
        {announcement.title}
      </p>
      <Link
        href="/parent/announcements"
        className="text-xs font-black underline shrink-0"
      >
        View →
      </Link>
    </div>
  );
}