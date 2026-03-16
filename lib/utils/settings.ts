// lib/utils/settings.ts
// Pure utility helpers for school settings — NOT a server action file.

import { fetchSchoolSettings } from "@/lib/actions/settings";

/** Returns the public URL for a logo stored in the school-assets bucket. */
export function getLogoPublicUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/school-assets/${path}`;
}

/** Returns the student photo public URL from the student-photos bucket. */
export function getStudentPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/student-photos/${path}`;
}

/**
 * Returns the active term and academic year from school_settings.
 * Falls back to a calendar-based heuristic so pages never break
 * if the settings row hasn't been seeded yet.
 *
 * Use this in every server page / route instead of hardcoding
 * `term = 1` or `academicYear = 2026`.
 */
export async function getActiveTermYear(): Promise<{
  term: 1 | 2 | 3;
  academicYear: number;
}> {
  const settings = await fetchSchoolSettings();

  if (settings) {
    return {
      term: settings.current_term,
      academicYear: settings.current_academic_year,
    };
  }

  // Fallback: calendar heuristic (Jan–Apr = T1, May–Aug = T2, Sep–Dec = T3)
  const month = new Date().getMonth() + 1; // 1-12
  const term = month <= 4 ? 1 : month <= 8 ? 2 : 3;
  return { term: term as 1 | 2 | 3, academicYear: new Date().getFullYear() };
}
