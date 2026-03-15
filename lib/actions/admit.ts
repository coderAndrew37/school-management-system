"use server";

// lib/actions/admit.ts

import { sendWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../supabase/admin";
import {
  admissionSchema,
  type AdmissionActionResult,
} from "../schemas/admission";
import { z } from "zod";

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

  const parsed = admissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }

  const d = parsed.data;

  // ── Manual conditional validation ────────────────────────────────────────────
  // When creating a new parent, name/email/phone are all required.
  if (!existingParentId) {
    if (!d.parentName?.trim())
      return { success: false, message: "Parent full name is required." };
    if (!d.parentEmail?.trim())
      return { success: false, message: "Parent email is required." };
    if (!d.parentPhone?.trim())
      return { success: false, message: "Parent phone number is required." };

    // Kenyan phone validation
    const phoneOk = /^(\+?254|0)[17]\d{8}$/.test(
      d.parentPhone.replace(/\s/g, ""),
    );
    if (!phoneOk)
      return {
        success: false,
        message: "Enter a valid Kenyan phone number (e.g. 0712345678).",
      };

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.parentEmail);
    if (!emailOk)
      return { success: false, message: "Enter a valid email address." };
  }

  try {
    let parentId: string;

    // ── FLOW A: Link to existing parent ───────────────────────────────────────
    if (existingParentId) {
      const { data: existing, error } = await supabaseAdmin
        .from("parents")
        .select("id, full_name, email")
        .eq("id", existingParentId)
        .maybeSingle();

      if (error || !existing) {
        return {
          success: false,
          message: "Selected parent could not be verified. Please try again.",
        };
      }

      // Check this student isn't already linked to the same parent
      const { data: existingLink } = await supabaseAdmin
        .from("student_parents")
        .select("id")
        .eq("parent_id", existingParentId)
        .limit(1);

      parentId = existing.id;
    } else {
      // ── FLOW B: Create new parent ─────────────────────────────────────────

      const { data: existingByEmail } = await supabaseAdmin
        .from("parents")
        .select("id")
        .eq("email", d.parentEmail!)
        .maybeSingle();

      if (existingByEmail) {
        return {
          success: false,
          message: `A parent with "${d.parentEmail}" already exists. Search and select them above instead.`,
        };
      }

      const { data: newAuthUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: d.parentEmail!,
          phone: d.parentPhone!,
          email_confirm: true,
          user_metadata: { full_name: d.parentName, role: "parent" },
        });

      if (authError)
        throw new Error(`Auth creation failed: ${authError.message}`);

      parentId = newAuthUser.user.id;

      const { error: parentError } = await supabaseAdmin
        .from("parents")
        .insert({
          id: parentId,
          full_name: d.parentName!,
          email: d.parentEmail!,
          phone_number: d.parentPhone!,
          invite_accepted: false,
        });

      if (parentError) {
        await supabaseAdmin.auth.admin.deleteUser(parentId);
        throw new Error(
          `Parent profile creation failed: ${parentError.message}`,
        );
      }

      const { data: linkData, error: linkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: d.parentEmail!,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
          },
        });

      if (linkError)
        throw new Error(`Setup link generation failed: ${linkError.message}`);

      try {
        await sendWelcomeEmail({
          parentEmail: d.parentEmail!,
          parentName: d.parentName!,
          studentName: d.studentName,
          grade: d.currentGrade,
          setupLink: linkData.properties.action_link,
        });
      } catch (mailErr) {
        console.error("Mail delivery failed:", mailErr);
        // Non-fatal
      }
    }

    // ── INSERT STUDENT ────────────────────────────────────────────────────────
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
      throw new Error(
        `Student registration failed: ${studentError?.message ?? "unknown error"}`,
      );
    }

    // ── LINK via join table ───────────────────────────────────────────────────
    const { error: linkErr } = await supabaseAdmin
      .from("student_parents")
      .insert({
        student_id: newStudent.id,
        parent_id: parentId,
        relationship_type: d.relationshipType ?? "guardian",
        is_primary_contact: true,
      });

    if (linkErr) {
      await supabaseAdmin.from("students").delete().eq("id", newStudent.id);
      throw new Error(`Student-parent link failed: ${linkErr.message}`);
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: "Student admitted successfully.",
      studentId: newStudent.id,
    };
  } catch (err: any) {
    console.error("Admission Error:", err.message);
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
        `email, full_name,
        student_parents (
          students ( full_name, current_grade )
        )`,
      )
      .eq("id", parentId)
      .single();

    if (pError || !parent) throw new Error("Parent record not found.");

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: parent.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
        },
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
    return { success: false, message: error.message };
  }
}

// ── Upload student passport photo ─────────────────────────────────────────────
// Called separately after admission so the photo upload doesn't block the
// admission flow if the network is slow. Also used for updating photos later.

export async function uploadStudentPhotoAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string; photo_url?: string }> {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0)
    return { success: false, message: "No file provided." };

  if (file.size > 2 * 1024 * 1024)
    return { success: false, message: "Photo must be under 2 MB." };

  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    return { success: false, message: "Photo must be JPEG, PNG, or WEBP." };

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
    console.error("Photo upload error:", uploadError.message);
    return {
      success: false,
      message: "Photo upload failed. Check storage bucket.",
    };
  }

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update({ photo_url: path })
    .eq("id", studentId);

  if (updateError) {
    return {
      success: false,
      message: "Photo uploaded but could not save path to student record.",
    };
  }

  revalidatePath("/admin/students");
  return { success: true, message: "Photo saved.", photo_url: path };
}
