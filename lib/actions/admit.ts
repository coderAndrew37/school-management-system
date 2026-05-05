"use server";

import { sendWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import {
  admissionSchema,
  type AdmissionActionResult,
} from "../schemas/admission";
import { supabaseAdmin } from "../supabase/admin";
import { getAuthConfirmUrl } from "../utils/site-url";
import { normalizeKenyanPhone, KENYAN_PHONE_REGEX } from "../utils/phone";

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
    const { data, error } = await supabaseAdmin
      .from("parents")
      .select(`
        id, full_name, email, phone_number,
        student_parents (
          students ( id, full_name, current_grade )
        )
      `)
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
  const existingParentId = (formData.get("existingParentId") as string | null) || null;

  const raw = {
    studentName: formData.get("studentName"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    classId: formData.get("classId"),
    relationshipType: formData.get("relationshipType") ?? "guardian",
    existingParentId,
    parentName: (formData.get("parentName") as string) || undefined,
    parentEmail: (formData.get("parentEmail") as string) || undefined,
    parentPhone: (formData.get("parentPhone") as string) || undefined,
  };

  const parsed = admissionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation failed.",
    };
  }

  const d = parsed.data;

  try {
    // ── 1. Resolve Class ──
    const { data: classRecord, error: classError } = await supabaseAdmin
      .from("classes")
      .select("id, grade")
      .eq("id", d.classId)
      .single();

    if (classError || !classRecord) {
      return {
        success: false,
        message: "The selected class record was not found. Please ensure classes are initialized.",
      };
    }

    let parentId: string;
    let isNewParent = false;

    // ── 2. Resolve / Create Parent ──
    if (existingParentId) {
      parentId = existingParentId;
    } else {
      const email = d.parentEmail!.toLowerCase().trim();
      const phone = normalizeKenyanPhone(d.parentPhone!);

      // Extra safety: Check both parents table and auth.users
      const { data: existingParent } = await supabaseAdmin
        .from("parents")
        .select("id")
        .or(`email.eq.${email},phone_number.eq.${phone}`)
        .maybeSingle();

      if (existingParent) {
        return {
          success: false,
          message: "A parent with this email or phone already exists.",
        };
      }

      // Check if auth user already exists (important when parent was previously deleted)
      const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers();

      if (existingAuth?.users && existingAuth.users.some(user => user.email === email)) {
        return {
          success: false,
          message: "A user with this email already exists in the system. Please use a different email.",
        };
      }

      // Create Auth User
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        phone,
        email_confirm: true,
        phone_confirm: true,
        user_metadata: { full_name: d.parentName, role: "parent" },
      });

      if (authError) throw new Error(`Auth creation failed: ${authError.message}`);

      parentId = authUser.user.id;
      isNewParent = true;

      // Create Parent Record
      const { error: parentErr } = await supabaseAdmin.from("parents").insert({
        id: parentId,
        full_name: d.parentName!,
        email,
        phone_number: phone,
        invite_accepted: false,
        last_invite_sent: new Date().toISOString(),
      });

      if (parentErr) {
        await supabaseAdmin.auth.admin.deleteUser(parentId).catch(console.error);
        throw new Error(`Parent record creation failed: ${parentErr.message}`);
      }
    }

    // ── 3. Create Student ──
    const { data: newStudent, error: studentError } = await supabaseAdmin
      .from("students")
      .insert({
        full_name: d.studentName,
        date_of_birth: d.dateOfBirth,
        gender: d.gender,
        current_grade: classRecord.grade,
        class_id: classRecord.id,
        status: "active",
      })
      .select("id")
      .single();

    if (studentError || !newStudent) {
      throw new Error(`Student registration failed: ${studentError?.message}`);
    }

    // ── 4. Handle Passport Photo ──
    const photoFile = formData.get("passportPhoto") as File | null;
    if (photoFile && photoFile.size > 0) {
      const ext = photoFile.type.split("/")[1] || "jpg";
      const path = `photos/${newStudent.id}.${ext}`;
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
        console.error("Photo upload failed:", uploadError.message);
      }
    }

    // ── 5. Link Student to Parent ──
    const { error: linkErr } = await supabaseAdmin
      .from("student_parents")
      .insert({
        student_id: newStudent.id,
        parent_id: parentId,
        relationship_type: d.relationshipType,
        is_primary_contact: true,
      });

    if (linkErr) {
      await supabaseAdmin.from("students").delete().eq("id", newStudent.id);
      throw new Error("Failed to link student to parent.");
    }

    // ── 6. Send Welcome Email (New Parents Only) ──
    if (isNewParent) {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: d.parentEmail!.toLowerCase(),
        options: { redirectTo: getAuthConfirmUrl() },
      });

      if (linkData?.properties?.action_link) {
        try {
          await sendWelcomeEmail({
            parentEmail: d.parentEmail!,
            parentName: d.parentName!,
            studentName: d.studentName,
            grade: classRecord.grade,
            setupLink: linkData.properties.action_link,
          });
        } catch (e) {
          console.error("Welcome email failed:", e);
        }
      }
    }

    revalidatePath("/admin/students");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: "Student admitted successfully.",
      studentId: newStudent.id,
    };

  } catch (err) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("[AdmitStudent] Error:", msg);
    return { success: false, message: msg };
  }
}

// ── 4. Resend Invite ─────────────────────────────────────────────────────────────

export async function resendInviteAction(parentId: string) {
  try {
    const { data: parent, error: pError } = await supabaseAdmin
      .from("parents")
      .select(`
        email, full_name,
        student_parents (
          students ( full_name, current_grade )
        )
      `)
      .eq("id", parentId)
      .single();

    if (pError || !parent) throw new Error("Parent record not found.");

    const rawParent = parent as unknown as RawResendInviteRow;

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: rawParent.email,
        options: { redirectTo: getAuthConfirmUrl() },
      });

    if (linkError) throw linkError;

    // Improved: Support multiple children
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