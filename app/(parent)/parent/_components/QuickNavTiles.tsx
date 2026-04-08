import {
  BookOpen,
  Image,
  MessageSquare,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

interface Tile {
  label: string;
  href: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
  count: number;
}

interface Props {
  diaryCount: number;
  unreadMessageCount: number;
  galleryCount: number;
  assessmentCount: number;
}

export function QuickNavTiles({
  diaryCount,
  unreadMessageCount,
  galleryCount,
  assessmentCount,
}: Props) {
  const tiles: Tile[] = [
    {
      label: "Diary",
      href: "/parent/diary",
      icon: BookOpen,
      color: "text-amber-500",
      bg: "bg-amber-50",
      border: "border-amber-100",
      count: diaryCount,
    },
    {
      label: "Messages",
      href: "/parent/messages",
      icon: MessageSquare,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-100",
      count: unreadMessageCount,
    },
    {
      label: "Gallery",
      href: "/parent/gallery",
      icon: Image,
      color: "text-purple-600",
      bg: "bg-purple-50",
      border: "border-purple-100",
      count: galleryCount,
    },
    {
      label: "Academics",
      href: "/parent/academics",
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-100",
      count: assessmentCount,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3">
      {tiles.map(({ label, href, icon: Icon, color, bg, border, count }) => (
        <Link
          key={href}
          href={href}
          className={`flex flex-col items-center gap-2 rounded-2xl border ${border} ${bg} p-3.5 hover:shadow-sm transition-all group`}
        >
          <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform">
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-700">{label}</p>
            {count > 0 && (
              <p className={`text-xs font-black ${color}`}>{count}</p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}