import { gradient } from "@/app/_components/parents/parent-utils";
import { Student } from "@/lib/types/dashboard";
import {
  getStudentPhotoUrl,
  getStudentInitials,
} from "@/lib/utils/photo-utils";
import Image from "next/image";

export default function StudentAvatar({
  student,
  size = "sm",
}: {
  student: Student;
  size?: "sm" | "lg";
}) {
  const url = getStudentPhotoUrl(student.photo_url);
  const initials = getStudentInitials(student.full_name);
  const grad = gradient(student.full_name);
  const cls =
    size === "lg"
      ? "h-16 w-16 rounded-2xl text-lg"
      : "h-8 w-8 rounded-lg text-xs";

  if (url)
    return (
      <div className={`relative flex-shrink-0 overflow-hidden ${cls}`}>
        <Image
          src={url}
          alt={student.full_name}
          fill
          unoptimized
          className="object-cover"
        />
      </div>
    );
  return (
    <div
      className={`flex-shrink-0 bg-linear-to-br ${grad} flex items-center justify-center font-bold text-white ${cls}`}
    >
      {initials}
    </div>
  );
}
