"use server";

// lib/actions/gallery.ts

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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

// ── Upload single image ───────────────────────────────────────────────────────

export async function uploadGalleryImageAction(
  formData: FormData,
): Promise<GalleryActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  // Validate metadata
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
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

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

  // Validate audience-specific requirements
  if (audience === "student" && !studentId) {
    return {
      success: false,
      message: "A student must be selected for student-specific posts.",
    };
  }
  if (audience === "class" && !targetGrade) {
    return {
      success: false,
      message: "A grade must be selected for class-wide posts.",
    };
  }

  // Get the image file
  const file = formData.get("image") as File | null;
  if (!file || file.size === 0) {
    return { success: false, message: "No image provided." };
  }

  // Validate file
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      success: false,
      message: "Only JPEG, PNG, WebP, or GIF images are allowed.",
    };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { success: false, message: "Image must be under 10 MB." };
  }

  // ── Upload to Supabase Storage ──────────────────────────────────────────────
  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from("gallery")
    .upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error(
      "[uploadGalleryImageAction] storage upload error:",
      uploadError.message,
    );
    return { success: false, message: `Upload failed: ${uploadError.message}` };
  }

  // Get the storage path (not a public URL — we'll generate signed URLs on read)
  const storagePath = fileName;

  // ── Insert DB record ────────────────────────────────────────────────────────
  const { data: inserted, error: dbError } = await supabase
    .from("talent_gallery")
    .insert({
      teacher_id: user.id,
      student_id: audience === "student" ? studentId : null,
      target_grade: audience === "class" ? targetGrade : null,
      audience,
      title,
      caption: caption ?? null,
      category: category ?? null,
      term: term ?? null,
      academic_year: academicYear,
      media_url: storagePath, // store path; app generates signed URL on read
    })
    .select("id")
    .single();

  if (dbError) {
    console.error(
      "[uploadGalleryImageAction] db insert error:",
      dbError.message,
    );
    // Attempt to clean up the uploaded file
    await supabaseAdmin.storage.from("gallery").remove([storagePath]);
    return { success: false, message: "Failed to save gallery record." };
  }

  revalidatePath("/teacher/gallery");
  revalidatePath("/parent");

  return {
    success: true,
    message: "Image uploaded successfully.",
    id: inserted.id,
    imageUrl: storagePath,
  };
}

// ── Bulk upload (multiple images at once) ────────────────────────────────────

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

  let uploaded = 0;
  let failed = 0;

  for (const file of files) {
    const fd = new FormData();
    fd.set("audience", metadata.audience);
    fd.set("studentId", metadata.studentId ?? "");
    fd.set("targetGrade", metadata.targetGrade ?? "");
    fd.set("title", metadata.title || file.name.replace(/\.[^.]+$/, ""));
    fd.set("caption", metadata.caption ?? "");
    fd.set("category", metadata.category ?? "");
    fd.set("term", String(metadata.term ?? ""));
    fd.set("academicYear", String(metadata.academicYear ?? 2026));
    fd.set("image", file);

    const result = await uploadGalleryImageAction(fd);
    if (result.success) {
      uploaded++;
    } else {
      failed++;
      console.error(
        "[bulkUploadGalleryAction] file failed:",
        file.name,
        result.message,
      );
    }
  }

  revalidatePath("/teacher/gallery");
  revalidatePath("/parent");

  return {
    success: failed === 0,
    uploaded,
    failed,
    message: `${uploaded} uploaded, ${failed} failed.`,
  };
}

// ── Delete gallery item ───────────────────────────────────────────────────────

export async function deleteGalleryItemAction(
  itemId: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  // Get the item first (to retrieve storage path)
  const { data: item, error: fetchErr } = await supabase
    .from("talent_gallery")
    .select("id, media_url, teacher_id")
    .eq("id", itemId)
    .single();

  if (fetchErr || !item) {
    return { success: false, message: "Item not found." };
  }

  // Soft-delete in DB
  const { error: delErr } = await supabase
    .from("talent_gallery")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);

  if (delErr) {
    return { success: false, message: "Failed to delete item." };
  }

  // Remove from storage (best-effort, don't fail if it errors)
  if (item.media_url) {
    await supabaseAdmin.storage.from("gallery").remove([item.media_url]);
  }

  revalidatePath("/teacher/gallery");
  revalidatePath("/parent");

  return { success: true, message: "Image deleted." };
}

// ── Generate signed URL for reading ──────────────────────────────────────────

export async function getSignedGalleryUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from("gallery")
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.error("[getSignedGalleryUrl] error:", error.message);
    return null;
  }

  return data.signedUrl;
}

// ── Fetch gallery items for teacher ──────────────────────────────────────────

export interface GalleryItemFull {
  id: string;
  student_id: string | null;
  target_grade: string | null;
  audience: "student" | "class" | "school";
  title: string;
  caption: string | null;
  category: string | null;
  media_url: string; // storage path
  signedUrl?: string; // hydrated after fetch
  term: number | null;
  academic_year: number;
  teacher_id: string | null;
  created_at: string;
  // joined
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
    console.error("[fetchTeacherGallery] error:", error.message);
    return [];
  }

  return (data ?? []) as GalleryItemFull[];
}
