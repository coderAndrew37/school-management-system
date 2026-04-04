import {
  getTeacherPhotoUrl,
  getTeacherInitials,
} from "@/lib/utils/photo-utils";
import type { Teacher } from "@/lib/types/dashboard";
import { AVATAR_COLORS } from "./constants";
import Image from "next/image";

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}

export function TeacherAvatar({
  teacher,
  className = "h-9 w-9 rounded-lg", // Increased default size slightly
}: {
  teacher: Teacher;
  className?: string;
}) {
  // Ensure we get a valid URL or null
  const photoUrl = getTeacherPhotoUrl(teacher.avatar_url);
  const initials = getTeacherInitials(teacher.full_name);
  const colorClass = avatarColor(teacher.full_name);

  return (
    <div
      className={`${className} relative flex-shrink-0 overflow-hidden flex items-center justify-center bg-gradient-to-br ${colorClass} text-white font-bold border border-white/10`}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={teacher.full_name}
          fill // Using fill for better responsiveness within the div
          className="object-cover"
          sizes="36px"
          priority={false}
        />
      ) : (
        <span
          className={className.includes("h-12") ? "text-sm" : "text-[10px]"}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
