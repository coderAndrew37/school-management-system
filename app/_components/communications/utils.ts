// app/_components/communications/utils.ts

import type {
  AudienceSelection,
  CommunicationsClientProps,
} from "@/lib/types/communications";

export function recipientCount(
  audience: AudienceSelection,
  teachers: CommunicationsClientProps["recipients"]["teachers"],
  parents: CommunicationsClientProps["recipients"]["parents"],
): string {
  switch (audience.type) {
    case "single_teacher":
    case "single_parent":
      return audience.individual ? "1 recipient" : "0 recipients";
    case "all_teachers":
      return `${teachers.length} recipients`;
    case "all_parents":
      return `${parents.length} recipients`;
    case "grade_parents":
      return audience.grade ? `Parents of ${audience.grade}` : "Select a grade";
    case "all_staff_and_parents":
      return `${teachers.length + parents.length} recipients`;
  }
}