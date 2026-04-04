export function getStudentPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/student-photos/${path}`;
}

/** Returns a placeholder avatar URL with the student's initials */
export function getStudentInitials(fullName: string): string {
  return fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function getTeacherPhotoUrl(path: string | null): string | null {
  if (!path) return null;

  // If the path is already a full URL, return it as is
  if (path.startsWith("http")) return path;

  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}

export function getTeacherInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}
