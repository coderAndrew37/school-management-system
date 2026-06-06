"use server";

import { sendWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import {
  admissionSchema,
  type AdmissionActionResult,
} from "../schemas/admission";
import { supabaseAdmin } from "../supabase/admin";
import { normalizeKenyanPhone } from "../utils/phone";
import { getAuthConfirmUrl } from "../utils/site-url";

// ── 1. Types & Row Interfaces ─────────────────────────────────────────────────

export interface ParentSearchResult {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  children: { id: string; full_name: string; current_grade: string }[];
}

interface RawParentSearchRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  student_parents: {
    students: { id: string; full_name: string; current_grade: string } | null;
  }[] | null;
}

interface RawResendInviteRow {
  email: string;
  full_name: string;
  student_parents: {
    students: { full_name: string; current_grade: string } | null;
  }[] | null;
}

// ── 2. Parent Search ─────────────────────────────────────────────────────────────

export async function searchParentsAction(
  query: string,
): Promise<{ success: boolean; data: ParentSearchResult[]; message?: string }> {
  if (!query || query.trim().length < 2) {
    return { success: true, data: [] };
  }

  const q = query.trim();

  try {
    // Replaced 'parents' table with 'profiles' table filtered by role
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select(`
        id, full_name, email, phone_number,
        student_parents (
          students ( id, full_name, current_grade )
        )
      `)
      .eq("role", "parent")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone_number.ilike.%${q}%`)
      .order("full_name")
      .limit(8)
      .returns<RawParentSearchRow[]>();

    if (error) throw error;

    const results: ParentSearchResult[] = (data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone_number: p.phone_number,
      children: (p.student_parents ?? [])
        .map((sp) => sp.students)
        .filter((s): s is NonNullable<typeof s> => !!s),
    }));

    return { success: true, data: results };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Search failed";
    console.error("[SearchParents] Error:", msg);
    return { success: false, data: [], message: msg };
  }
}

// ── 3. Admit Student ──────────────────────────────────────────────────────────

export async function admitStudentAction(
  formData: FormData,
): Promise<AdmissionActionResult> {
  const existingParentId =
    (formData.get("existingParentId") as string | null) || null;

  const raw = {
    studentName:      formData.get("studentName"),
    dateOfBirth:      formData.get("dateOfBirth"),
    gender:           formData.get("gender"),
    classId:          formData.get("classId"),
    upiNumber:        (formData.get("upiNumber") as string) || undefined,
    relationshipType: formData.get("relationshipType") ?? "guardian",
    existingParentId,
    parentName:       (formData.get("parentName")  as string) || undefined,
    parentEmail:      (formData.get("parentEmail") as string) || undefined,
    parentPhone:      (formData.get("parentPhone") as string) || undefined,
  };

  const parsed = admissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }

  const d = parsed.data;

  // Shared rollback helper — PostgREST builders are NOT thenables until awaited,
  // so .catch() doesn't exist on the builder itself. We wrap in try/catch instead.
  async function rollbackParent(pid: string): Promise<void> {
    try {
      await supabaseAdmin.auth.admin.deleteUser(pid);
    } catch (e) {
      console.error("[rollbackParent] auth.deleteUser failed:", e);
    }
    try {
      await supabaseAdmin.from("profiles").delete().eq("id", pid);
    } catch (e) {
      console.error("[rollbackParent] profiles.delete failed:", e);
    }
  }

  try {
    // ── 1. Resolve class & school ─────────────────────────────────────────────
    // MUST happen before the parent branch so schoolId is available in both paths
    const { data: classRecord, error: classError } = await supabaseAdmin
      .from("classes")
      .select("id, grade, school_id")
      .eq("id", d.classId)
      .single();

    if (classError || !classRecord) {
      return {
        success: false,
        message: "The selected class was not found. Please ensure classes are initialised.",
      };
    }

    const schoolId = classRecord.school_id;

    let parentId: string;
    let isNewParent = false;

    // ── 2. Resolve / create parent ────────────────────────────────────────────
    if (existingParentId) {
      // Verify the profile exists and is actually a parent before proceeding
      const { data: existingProfile, error: profileCheckErr } =
        await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("id", existingParentId)
          .eq("role", "parent")
          .maybeSingle();

      if (profileCheckErr || !existingProfile) {
        return {
          success: false,
          message: "The selected parent account could not be found.",
        };
      }

      parentId = existingParentId;

    } else {
      // ── New parent flow ───────────────────────────────────────────────────
      const email = d.parentEmail!.toLowerCase().trim();
      const phone = normalizeKenyanPhone(d.parentPhone!);

      // 2a. Check profiles table for duplicate email or phone
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .or(`email.eq.${email},phone_number.eq.${phone}`)
        .maybeSingle();

      if (existingProfile) {
        return {
          success: false,
          message:
            "A profile with this email or phone already exists. Search for them as an existing parent.",
        };
      }

      // 2b. Check auth.users for duplicate email.
      // Note: some GoTrue admin clients/types don't expose a getUserByEmail
      // helper. We'll rely on handling duplicate-email errors from the
      // createUser call below instead of doing a separate lookup.

      // 2c. Create auth user
      const { data: authUser, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          phone,
          email_confirm:  true,
          phone_confirm:  true,
          user_metadata:  { full_name: d.parentName, base_role: "parent" },
        });

      if (authError) {
        // If the email already exists in auth, surface a friendly message.
        if (authError.message && authError.message.toLowerCase().includes("already")) {
          return {
            success: false,
            message:
              "An auth account with this email already exists. Search for them as an existing parent.",
          };
        }
        throw new Error(`Auth creation failed: ${authError.message}`);
      }

      parentId    = authUser.user.id;
      isNewParent = true;

      // 2d. Create profile row — upsert handles rare trigger-race collisions
      const { error: profileErr } = await supabaseAdmin
        .from("profiles")
        .upsert(
          {
            id:           parentId,
            full_name:    d.parentName!,
            email,
            phone_number: phone,
            role:         "parent",
            school_id:    schoolId,
          },
          { onConflict: "id" },
        );

      if (profileErr) {
        await rollbackParent(parentId);
        throw new Error(`Profile creation failed: ${profileErr.message}`);
      }
    }

    // ── 3. Create student ─────────────────────────────────────────────────────
    const { data: newStudent, error: studentError } = await supabaseAdmin
      .from("students")
      .insert({
        full_name:     d.studentName,
        date_of_birth: d.dateOfBirth,
        gender:        d.gender,
        current_grade: classRecord.grade,
        class_id:      classRecord.id,
        school_id:     schoolId,
        status:        "active",
        // Omit upi_number entirely when not provided — inserting null would
        // conflict with the unique constraint if another null row exists in
        // some Postgres configurations (though null != null, safer to omit)
        ...(d.upiNumber ? { upi_number: d.upiNumber } : {}),
      })
      .select("id")
      .single();

    if (studentError || !newStudent) {
      if (isNewParent) await rollbackParent(parentId);
      throw new Error(`Student registration failed: ${studentError?.message}`);
    }

    // ── 4. Photo upload (optional, non-blocking) ──────────────────────────────
    const photoFile = formData.get("passportPhoto") as File | null;
    if (photoFile && photoFile.size > 0) {
      try {
        const ext    = photoFile.type.split("/")[1] || "jpg";
        const path   = `photos/${newStudent.id}.${ext}`;
        const buffer = Buffer.from(await photoFile.arrayBuffer());

        const { error: uploadError } = await supabaseAdmin.storage
          .from("student-photos")
          .upload(path, buffer, { contentType: photoFile.type, upsert: true });

        if (!uploadError) {
          await supabaseAdmin
            .from("students")
            .update({ photo_url: path })
            .eq("id", newStudent.id);
        } else {
          console.error("[admitStudent] Photo upload failed:", uploadError.message);
        }
      } catch (photoErr) {
        // Photo failure is non-fatal — student is already created
        console.error("[admitStudent] Photo error:", photoErr);
      }
    }

    // ── 5. Link student ↔ parent ──────────────────────────────────────────────
    const { error: linkErr } = await supabaseAdmin
      .from("student_parents")
      .insert({
        student_id:         newStudent.id,
        parent_id:          parentId,
        relationship_type:  d.relationshipType,
        is_primary_contact: true,
        school_id:          schoolId,
      });

    if (linkErr) {
      // Roll back student row; roll back parent only if we just created them
      try {
        await supabaseAdmin.from("students").delete().eq("id", newStudent.id);
      } catch (e) {
        console.error("[admitStudent] student rollback failed:", e);
      }
      if (isNewParent) await rollbackParent(parentId);
      throw new Error(`Failed to link student to parent: ${linkErr.message}`);
    }

    // ── 6. Welcome email (new parents only) ───────────────────────────────────
    if (isNewParent) {
      try {
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type:    "recovery",
          email:   d.parentEmail!.toLowerCase(),
          options: { redirectTo: getAuthConfirmUrl() },
        });

        if (linkData?.properties?.action_link) {
          await sendWelcomeEmail({
            parentEmail: d.parentEmail!.toLowerCase(),
            parentName:  d.parentName!,
            studentName: d.studentName,
            grade:       classRecord.grade,
            setupLink:   linkData.properties.action_link,
          });
        }
      } catch (emailErr) {
        // Email failure is non-fatal — admission is complete
        console.error("[admitStudent] Welcome email failed:", emailErr);
      }
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/dashboard");

    return {
      success:   true,
      message:   "Student admitted successfully.",
      studentId: newStudent.id,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("[AdmitStudent]", msg);
    return { success: false, message: msg };
  }
}

// ── 4. Resend Invite ─────────────────────────────────────────────────────────────

export async function resendInviteAction(parentId: string) {
  try {
    // Replaced 'parents' table with 'profiles' table
    const { data: profile, error: pError } = await supabaseAdmin
      .from("profiles")
      .select(`
        email, full_name,
        student_parents (
          students ( full_name, current_grade )
        )
      `)
      .eq("id", parentId)
      .eq("role", "parent")
      .single();

    if (pError || !profile) throw new Error("Parent profile record not found.");

    const rawParent = profile as unknown as RawResendInviteRow;
    if (!rawParent.email) throw new Error("Parent profile does not have a valid email address.");

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: rawParent.email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkError) throw linkError;

    const children = rawParent.student_parents
      ?.map((sp) => sp.students)
      .filter((s): s is NonNullable<typeof s> => !!s) || [];

    const studentName = children.length > 0
      ? children.map(c => c.full_name).join(", ")
      : "your child";

    await sendWelcomeEmail({
      parentEmail: rawParent.email,
      parentName: rawParent.full_name,
      studentName,
      grade: children[0]?.current_grade ?? "—",
      setupLink: linkData.properties.action_link,
    });

    return { success: true, message: "A new secure invite has been sent." };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Resend failed";
    console.error("[ResendInvite] Error:", msg);
    return { success: false, message: msg };
  }
}

// ── 5. Photo Upload ─────────────────────────────────────────────────────────────

export async function uploadStudentPhotoAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; message: string; photo_url?: string }> {
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0)
    return { success: false, message: "No file provided." };
  if (file.size > 2 * 1024 * 1024)
    return { success: false, message: "Photo must be under 2 MB." };

  const ext = file.type.split("/")[1] || "jpg";
  const path = `photos/${studentId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage
    .from("student-photos")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) return { success: false, message: "Photo upload failed." };

  const { error: updateError } = await supabaseAdmin
    .from("students")
    .update({ photo_url: path })
    .eq("id", studentId);

  if (updateError)
    return { success: false, message: "Could not update record." };

  revalidatePath("/admin/students");
  return { success: true, message: "Photo saved.", photo_url: path };
}