import type { GalleryItemFull } from "@/lib/actions/gallery";
import type { ClassStudent } from "@/lib/data/assessment";

export type Audience = "student" | "class" | "school";

export interface GalleryClientProps {
  teacherName: string;
  teacherId: string;
  grades: string[];
  studentsByGrade: Record<string, ClassStudent[]>;
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
  targetGrade: string | null;
  title: string;
  caption: string | null;
  category: string | null;
  term: number | null;
  academicYear: number;
}