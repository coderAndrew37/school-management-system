"use server";

import { sendWelcomeEmail } from "@/lib/mail";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { AdmissionActionResult, admissionSchema } from "../schemas/admission";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
    existingParentId,
    parentName: existingParentId
      ? (formData.get("parentName") ?? "placeholder")
      : formData.get("parentName"),
    parentEmail: existingParentId
      ? (formData.get("parentEmail") ?? "placeholder@placeholder.com")
      : formData.get("parentEmail"),
    parentPhone: existingParentId ? "0700000000" : formData.get("parentPhone"),
  };

  const parsed = admissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }

  const {
    studentName,
    dateOfBirth,
    gender,
    currentGrade,
    parentPhone,
    parentEmail,
    parentName,
    relationshipType,
  } = parsed.data;

  try {
    let parentId: string;

    // ── FLOW A: Link to existing parent ──────────────────────────────────────
    if (existingParentId) {
      const { data: existing, error } = await supabaseAdmin
        .from("parents")
        .select("id")
        .eq("id", existingParentId)
        .maybeSingle();

      if (error || !existing) {
        return {
          success: false,
          message: "Selected parent could not be verified. Please try again.",
        };
      }

      parentId = existing.id;
    } else {
      // ── FLOW B: Create new parent ─────────────────────────────────────────

      const { data: existingByEmail } = await supabaseAdmin
        .from("parents")
        .select("id")
        .eq("email", parentEmail)
        .maybeSingle();

      if (existingByEmail) {
        return {
          success: false,
          message: `A parent with the email "${parentEmail}" already exists. Search and select them above instead.`,
        };
      }

      const { data: newAuthUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email: parentEmail,
          phone: parentPhone,
          email_confirm: true,
          user_metadata: { full_name: parentName, role: "parent" },
        });

      if (authError) {
        throw new Error(`Auth creation failed: ${authError.message}`);
      }

      parentId = newAuthUser.user.id;

      const { error: parentError } = await supabaseAdmin
        .from("parents")
        .insert({
          id: parentId,
          full_name: parentName,
          email: parentEmail,
          phone_number: parentPhone,
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
          email: parentEmail,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
          },
        });

      if (linkError) {
        throw new Error(`Setup link generation failed: ${linkError.message}`);
      }

      const setupLink = linkData.properties.action_link;

      try {
        await sendWelcomeEmail({
          parentEmail,
          parentName,
          studentName,
          grade: currentGrade, // ← added
          setupLink,
        });
      } catch (mailErr) {
        console.error("Mail delivery failed:", mailErr);
        // Non-fatal — student is still admitted, admin can resend invite
      }
    }

    // ── INSERT STUDENT ────────────────────────────────────────────────────────
    const { data: newStudent, error: studentError } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: studentName,
        date_of_birth: dateOfBirth,
        gender,
        current_grade: currentGrade,
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
        relationship_type: relationshipType,
        is_primary_contact: true,
      });

    if (linkErr) {
      await supabaseAdmin.from("students").delete().eq("id", newStudent.id);
      throw new Error(`Student-parent link failed: ${linkErr.message}`);
    }

    revalidatePath("/students");
    revalidatePath("/parents");
    revalidatePath("/dashboard");

    return { success: true, message: "Student admitted successfully." };
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

    const setupLink = linkData.properties.action_link;
    const firstChild = (parent.student_parents as any[])?.[0]?.students;

    await sendWelcomeEmail({
      parentEmail: parent.email,
      parentName: parent.full_name,
      studentName: firstChild?.full_name ?? "your child",
      grade: firstChild?.current_grade ?? "—", // ← added
      setupLink,
    });

    return { success: true, message: "A new secure invite has been sent." };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
