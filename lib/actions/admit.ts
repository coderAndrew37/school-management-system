"use server";

// lib/actions/admit.ts

import { sendWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import {
  admissionSchema,
  type AdmissionActionResult,
} from "../schemas/admission";
import { supabaseAdmin } from "../supabase/admin";
import { getAuthConfirmUrl } from "../utils/site-url";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParentSearchResult {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  children: { id: string; full_name: string; current_grade: string }[];
}

// ── Parent Search ─────────────────────────────────────────────────────────────

export async function searchParentsAction(
  query: string,
): Promise<{ success: boolean; data: ParentSearchResult[]; message?: string }> {
  if (!query || query.trim().length < 2) {
    return { success: true, data: [] };
  }

  const q = query.trim();

  try {
    const { data, error } = await supabaseAdmin
      .from("parents")
      .select(
        `id, full_name, email, phone_number,
        student_parents (
          students ( id, full_name, current_grade )
        )`,
      )
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone_number.ilike.%${q}%`)
      .order("full_name")
      .limit(8);

    if (error) throw error;

    const results: ParentSearchResult[] = (data ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone_number: p.phone_number,
      children: (p.student_parents ?? [])
        .map((sp: any) => sp.students)
        .filter(Boolean),
    }));

    return { success: true, data: results };
  } catch (err: any) {
    console.error("[SearchParents] Error:", err.message);
    return { success: false, data: [], message: err.message };
  }
}

// ── Admit Student ─────────────────────────────────────────────────────────────

export async function admitStudentAction(
  formData: FormData,
): Promise<AdmissionActionResult> {
  const existingParentId =
    (formData.get("existingParentId") as string | null) || null;

  const raw = {
    studentName: formData.get("studentName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    currentGrade: formData.get("currentGrade"),
    relationshipType: formData.get("relationshipType") ?? "guardian",
    existingParentId: existingParentId,
    parentName: formData.get("parentName") || null,
    parentEmail: formData.get("parentEmail") || null,
    parentPhone: formData.get("parentPhone") || null,
  };

  console.log(
    "[AdmitStudent] Starting admission for student:",
    raw.studentName,
  );

  const parsed = admissionSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn(
      "[AdmitStudent] Validation failed:",
      parsed.error.issues[0]?.message,
    );
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }

  const d = parsed.data;

  // ── Manual conditional validation for new parents ────────────────────────────
  if (!existingParentId) {
    if (
      !d.parentName?.trim() ||
      !d.parentEmail?.trim() ||
      !d.parentPhone?.trim()
    ) {
      return {
        success: false,
        message: "Parent name, email, and phone are required.",
      };
    }

    // Updated regex to support 07... and 01... prefixes
    const phoneOk = /^(\+?254|0)[17]\d{8}$/.test(
      d.parentPhone.replace(/\s/g, ""),
    );
    if (!phoneOk)
      return { success: false, message: "Enter a valid Kenyan phone number." };
  }

  try {
    let parentId: string;

    // ── FLOW A: Link to existing parent ───────────────────────────────────────
    if (existingParentId) {
      console.log(
        "[AdmitStudent] Linking to existing parent:",
        existingParentId,
      );
      const { data: existing, error } = await supabaseAdmin
        .from("parents")
        .select("id")
        .eq("id", existingParentId)
        .maybeSingle();

      if (error || !existing) {
        return { success: false, message: "Selected parent not found." };
      }
      parentId = existing.id;
    } else {
      // ── FLOW B: Create new parent ─────────────────────────────────────────

      // 1. Pre-check email/phone to avoid 422 Auth errors
      console.log("[AdmitStudent] Checking for duplicate email/phone...");
      const { data: existingParent } = await supabaseAdmin
        .from("parents")
        .select("id, email, phone_number")
        .or(`email.eq.${d.parentEmail},phone_number.eq.${d.parentPhone}`)
        .maybeSingle();

      if (existingParent) {
        const conflict =
          existingParent.email === d.parentEmail ? "email" : "phone number";
        return {
          success: false,
          message: `A parent with this ${conflict} already exists.`,
        };
      }

      // ── Phone Normalization (The "Swiss Army Knife" for Kenya) ──
      const rawPhone = d.parentPhone!.replace(/\s/g, "");
      let formattedPhone: string;

      if (rawPhone.startsWith("+254")) {
        formattedPhone = rawPhone;
      } else if (rawPhone.startsWith("254")) {
        formattedPhone = `+${rawPhone}`;
      } else if (rawPhone.startsWith("0")) {
        // Handles 07... and 01...
        formattedPhone = `+254${rawPhone.slice(1)}`;
      } else {
        // Handles cases where user starts with 7... or 1...
        formattedPhone = `+254${rawPhone}`;
      }

      // 2. Create Auth User
      // NOTE: This call triggers handle_new_user in DB (Atomic Trigger)
      console.log(
        "[AdmitStudent] Creating Auth user with phone:",
        formattedPhone,
      );
      const { data: authUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: d.parentEmail!,
          phone: formattedPhone,
          email_confirm: true,
          user_metadata: {
            full_name: d.parentName,
            role: "parent",
          },
        });

      if (authError) {
        console.error("[AdmitStudent] Auth Creation Error:", authError);
        throw new Error(`Auth creation failed: ${authError.message}`);
      }

      parentId = authUser.user.id;
      console.log(
        "[AdmitStudent] Auth user and DB records created via trigger:",
        parentId,
      );

      // 3. Generate Setup Link
      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: d.parentEmail!,
          options: { redirectTo: getAuthConfirmUrl() },
        });

      if (linkError) {
        console.error("[AdmitStudent] Setup link error:", linkError);
      } else {
        // 4. Send Welcome Email (Non-fatal)
        try {
          await sendWelcomeEmail({
            parentEmail: d.parentEmail!,
            parentName: d.parentName!,
            studentName: d.studentName,
            grade: d.currentGrade,
            setupLink: linkData.properties.action_link,
          });
          console.log("[AdmitStudent] Welcome email sent.");
        } catch (mailErr) {
          console.error("[AdmitStudent] Mail delivery failed:", mailErr);
        }
      }
    }

    // ── INSERT STUDENT ────────────────────────────────────────────────────────
    console.log("[AdmitStudent] Registering student...");
    const { data: newStudent, error: studentError } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: d.studentName,
        date_of_birth: d.dateOfBirth,
        gender: d.gender,
        current_grade: d.currentGrade,
      })
      .select("id")
      .single();

    if (studentError || !newStudent) {
      console.error("[AdmitStudent] Student Table Error:", studentError);
      throw new Error(
        `Student registration failed: ${studentError?.message ?? "DB Error"}`,
      );
    }

    // ── LINK via join table ───────────────────────────────────────────────────
    console.log("[AdmitStudent] Linking student to parent...");
    const { error: linkErr } = await supabaseAdmin
      .from("student_parents")
      .insert({
        student_id: newStudent.id,
        parent_id: parentId,
        relationship_type: d.relationshipType as any,
        is_primary_contact: true,
      });

    if (linkErr) {
      console.error("[AdmitStudent] Link Table Error:", linkErr);
      // Rollback student if linking fails
      await supabaseAdmin.from("students").delete().eq("id", newStudent.id);
      throw new Error(`Student-parent link failed: ${linkErr.message}`);
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/dashboard");

    console.log("[AdmitStudent] Process complete.");
    return {
      success: true,
      message: "Student admitted successfully.",
      studentId: newStudent.id,
    };
  } catch (err: any) {
    console.error("[AdmitStudent] Global Catch Block:", err);
    return {
      success: false,
      message: err.message || "An unexpected error occurred.",
    };
  }
}

// ── Resend Invite ─────────────────────────────────────────────────────────────

export async function resendInviteAction(parentId: string) {
  try {
    const { data: parent, error: pError } = await supabaseAdmin
      .from("parents")
      .select(
        `
        email, full_name,
        student_parents (
          students ( full_name, current_grade )
        )
      `,
      )
      .eq("id", parentId)
      .single();

    if (pError || !parent) throw new Error("Parent record not found.");

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: parent.email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkError) throw linkError;

    const firstChild = (parent.student_parents as any[])?.[0]?.students;

    await sendWelcomeEmail({
      parentEmail: parent.email,
      parentName: parent.full_name,
      studentName: firstChild?.full_name ?? "your child",
      grade: firstChild?.current_grade ?? "—",
      setupLink: linkData.properties.action_link,
    });

    return { success: true, message: "A new secure invite has been sent." };
  } catch (error: any) {
    console.error("[ResendInvite] Error:", error.message);
    return { success: false, message: error.message };
  }
}

// ── Upload student passport photo ─────────────────────────────────────────────

export async function uploadStudentPhotoAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string; photo_url?: string }> {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0)
    return { success: false, message: "No file provided." };

  if (file.size > 2 * 1024 * 1024)
    return { success: false, message: "Photo must be under 2 MB." };

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";
  const path = `photos/${studentId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("student-photos")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("[UploadPhoto] Storage error:", uploadError.message);
    return { success: false, message: "Photo upload failed." };
  }

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update({ photo_url: path })
    .eq("id", studentId);

  if (updateError) {
    console.error("[UploadPhoto] DB Update error:", updateError.message);
    return {
      success: false,
      message: "Could not update student record with photo.",
    };
  }

  revalidatePath("/admin/students");
  return { success: true, message: "Photo saved.", photo_url: path };
}
