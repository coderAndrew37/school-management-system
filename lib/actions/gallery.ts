"use server";

// lib/actions/gallery.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export interface GalleryActionResult {
  success: boolean;
  message: string;
  id?: string;
  imageUrl?: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

const gallerySchema = z.object({
  audience: z.enum(["student", "class", "school"]),
  studentId: z.string().uuid().optional().nullable(),
  targetGrade: z.string().optional().nullable(),
  title: z.string().min(1, "Title is required").max(200),
  caption: z.string().max(1000).optional().nullable(),
  category: z.string().optional().nullable(),
  term: z.coerce.number().int().min(1).max(3).optional().nullable(),
  academicYear: z.coerce.number().int().default(2026),
});

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ── Core upload — extracts shared logic used by both single + bulk ────────────

async function uploadOneImage(
  userId: string,
  file: File,
  meta: {
    audience: "student" | "class" | "school";
    studentId: string | null;
    targetGrade: string | null;
    title: string;
    caption: string | null;
    category: string | null;
    term: number | null;
    academicYear: number;
  },
): Promise<GalleryActionResult> {
  if (!ALLOWED_TYPES.includes(file.type))
    return {
      success: false,
      message: "Only JPEG, PNG, WebP, or GIF images are allowed.",
    };
  if (file.size > MAX_SIZE)
    return { success: false, message: "Image must be under 10 MB." };

  const supabase = await createSupabaseServerClient();

  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${userId}/${crypto.randomUUID()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("gallery")
    .upload(fileName, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[gallery] storage upload:", uploadError.message);
    return { success: false, message: `Upload failed: ${uploadError.message}` };
  }

  const { data: inserted, error: dbError } = await supabase
    .from("talent_gallery")
    .insert({
      teacher_id: userId,
      student_id: meta.audience === "student" ? meta.studentId : null,
      target_grade: meta.audience === "class" ? meta.targetGrade : null,
      audience: meta.audience,
      title: meta.title,
      caption: meta.caption ?? null,
      category: meta.category ?? null,
      term: meta.term ?? null,
      academic_year: meta.academicYear,
      media_url: fileName,
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("[gallery] db insert:", dbError.message);
    // Best-effort storage cleanup
    await supabaseAdmin.storage.from("gallery").remove([fileName]);
    return { success: false, message: "Failed to save gallery record." };
  }

  return {
    success: true,
    message: "Uploaded.",
    id: inserted.id,
    imageUrl: fileName,
  };
}

// ── Single image upload (form action) ────────────────────────────────────────

export async function uploadGalleryImageAction(
  formData: FormData,
): Promise<GalleryActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const raw = {
    audience: formData.get("audience"),
    studentId: formData.get("studentId") || null,
    targetGrade: formData.get("targetGrade") || null,
    title: formData.get("title"),
    caption: formData.get("caption") || null,
    category: formData.get("category") || null,
    term: formData.get("term") || null,
    academicYear: formData.get("academicYear") || 2026,
  };

  const parsed = gallerySchema.safeParse(raw);
  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };

  const {
    audience,
    studentId,
    targetGrade,
    title,
    caption,
    category,
    term,
    academicYear,
  } = parsed.data;

  if (audience === "student" && !studentId)
    return {
      success: false,
      message: "A student must be selected for student-specific posts.",
    };
  if (audience === "class" && !targetGrade)
    return {
      success: false,
      message: "A grade must be selected for class-wide posts.",
    };

  const file = formData.get("image") as File | null;
  if (!file || file.size === 0)
    return { success: false, message: "No image provided." };

  const result = await uploadOneImage(user.id, file, {
    audience,
    studentId: studentId ?? null,
    targetGrade: targetGrade ?? null,
    title,
    caption: caption ?? null,
    category: category ?? null,
    term: term ?? null,
    academicYear,
  });

  if (result.success) {
    revalidatePath("/teacher/gallery");
    revalidatePath("/parent");
  }
  return result;
}

// ── Bulk upload — all files in parallel (no serial re-auth per file) ──────────

export async function bulkUploadGalleryAction(
  files: File[],
  metadata: {
    audience: "student" | "class" | "school";
    studentId?: string | null;
    targetGrade?: string | null;
    title: string;
    caption?: string | null;
    category?: string | null;
    term?: number | null;
    academicYear?: number;
  },
): Promise<{
  success: boolean;
  uploaded: number;
  failed: number;
  message: string;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      success: false,
      uploaded: 0,
      failed: files.length,
      message: "Not authenticated.",
    };

  const meta = {
    audience: metadata.audience,
    studentId: metadata.studentId ?? null,
    targetGrade: metadata.targetGrade ?? null,
    title: metadata.title,
    caption: metadata.caption ?? null,
    category: metadata.category ?? null,
    term: metadata.term ?? null,
    academicYear: metadata.academicYear ?? 2026,
  };

  // Upload all files in parallel — single auth check above, no per-file re-auth
  const results = await Promise.all(
    files.map((file) =>
      uploadOneImage(user.id, file, {
        ...meta,
        // Per-file title: use file name if shared title is generic
        title:
          metadata.title ||
          file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      }),
    ),
  );

  const uploaded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  if (failed > 0) {
    results
      .filter((r) => !r.success)
      .forEach((r, i) =>
        console.error(`[bulkUpload] file ${i} failed:`, r.message),
      );
  }

  revalidatePath("/teacher/gallery");
  revalidatePath("/parent");

  return {
    success: failed === 0,
    uploaded,
    failed,
    message: `${uploaded} uploaded${failed > 0 ? `, ${failed} failed` : ""}.`,
  };
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteGalleryItemAction(
  itemId: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const { data: item, error: fetchErr } = await supabase
    .from("talent_gallery")
    .select("id, media_url, teacher_id")
    .eq("id", itemId)
    .single();

  if (fetchErr || !item) return { success: false, message: "Item not found." };

  const { error: delErr } = await supabase
    .from("talent_gallery")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);

  if (delErr) return { success: false, message: "Failed to delete item." };

  // Best-effort storage cleanup
  if (item.media_url)
    await supabaseAdmin.storage.from("gallery").remove([item.media_url]);

  revalidatePath("/teacher/gallery");
  revalidatePath("/parent");
  return { success: true, message: "Image deleted." };
}

// ── Signed URL ────────────────────────────────────────────────────────────────

export async function getSignedGalleryUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from("gallery")
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) {
    console.error("[getSignedGalleryUrl]", error.message);
    return null;
  }
  return data.signedUrl;
}

// ── Fetch teacher's gallery ───────────────────────────────────────────────────

export interface GalleryItemFull {
  id: string;
  student_id: string | null;
  target_grade: string | null;
  audience: "student" | "class" | "school";
  title: string;
  caption: string | null;
  category: string | null;
  media_url: string;
  signedUrl?: string;
  term: number | null;
  academic_year: number;
  teacher_id: string | null;
  created_at: string;
  student_name?: string;
}

export async function fetchTeacherGallery(
  teacherId: string,
  limit = 60,
): Promise<GalleryItemFull[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("talent_gallery")
    .select(
      "id, student_id, target_grade, audience, title, caption, category, media_url, term, academic_year, teacher_id, created_at",
    )
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[fetchTeacherGallery]", error.message);
    return [];
  }
  return (data ?? []) as GalleryItemFull[];
}
