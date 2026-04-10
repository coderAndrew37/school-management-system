import type { Audience } from "./gallery.types";

export const CATEGORIES = [
  "Mathematics Activity",
  "Science Experiment",
  "Creative Arts",
  "Language & Literacy",
  "Environmental Activity",
  "Physical Education",
  "Social Studies",
  "Agriculture Activity",
  "Music Performance",
  "Drama & Performing Arts",
  "Home Science",
  "School Event",
  "Field Trip",
  "Achievement",
  "Other",
] as const;

export const AUDIENCE_CONFIG: Record<
  Audience,
  { label: string; desc: string; color: string; bg: string; border: string }
> = {
  student: {
    label: "Specific Student",
    desc: "Only this student's parent sees it",
    color: "text-sky-700",
    bg: "bg-sky-50",
    border: "border-sky-400",
  },
  class: {
    label: "Entire Class",
    desc: "All parents in this grade see it",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-400",
  },
  school: {
    label: "Whole School",
    desc: "All parents at Kibali Academy see it",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-400",
  },
};

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB