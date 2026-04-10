import type { GalleryItemFull } from "@/lib/actions/gallery";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function audienceBadge(
  item: GalleryItemFull,
  studentNameMap: Record<string, string>,
): string {
  if (item.audience === "student" && item.student_id)
    return studentNameMap[item.student_id] ?? "Unknown student";
  if (item.audience === "class") return item.target_grade ?? "Class";
  return "All parents";
}