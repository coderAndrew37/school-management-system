// app/teacher/class/attendance/gallery.types.ts

import type { GalleryItemFull } from "@/lib/actions/gallery";
import type { ClassStudent } from "@/lib/data/assessment";

export type Audience = "student" | "class" | "school";

/**
 * Matches the public.classes table schema
 */
export interface ClassMetadata {
  id: string; // uuid
  grade: string; // text
  stream: string; // text
  academic_year: number;
  level: 'lower_primary' | 'upper_primary' | 'junior_secondary';
}

export interface GalleryClientProps {
  teacherName: string;
  teacherId: string;
  // Changed from string[] to ClassMetadata[] to support UUID lookups
  classes: ClassMetadata[]; 
  // Keyed by classId (UUID) to avoid syntax errors
  studentsByClass: Record<string, ClassStudent[]>;
  studentNameMap: Record<string, string>;
  initialItems: (GalleryItemFull & { signedUrl: string })[];
  academicYear: number;
}

export interface PendingFile {
  id: string;
  file: File;
  preview: string;
  title: string;
  status: "pending" | "uploading" | "done" | "error";
  errorMsg?: string;
}

export interface UploadMeta {
  audience: Audience;
  studentId: string | null;
  targetClassId: string | null; // Changed from targetGrade to targetClassId
  title: string;
  caption: string | null;
  category: string | null;
  term: number | null;
  academicYear: number;
}

export type GalleryItem = GalleryItemFull & { signedUrl: string };