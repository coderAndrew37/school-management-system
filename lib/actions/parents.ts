"use server";

// lib/actions/parents.ts
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/actions/auth";

// --- Types & Interfaces ---
const ADMIN_ROLES = ["admin", "superadmin"] as const;

interface ActionResult {
  success: boolean;
  message: string;
}

interface RawParentExportRow {
  full_name: string;
  email: string;
  phone_number: string | null;
  invite_accepted: boolean | null;
  created_at: string;
  student_parents: {
    students: { full_name: string; current_grade: string } | null;
  }[];
}

export interface ParentExportData {
  full_name: string;
  email: string;
  phone_number: string;
  invite_accepted: boolean;
  created_at: string;
  children: string;
}

// --- Auth Guard ---
async function requireAdmin() {
  const session = await getSession();
  if (!session || !ADMIN_ROLES.includes(session.profile.role as (typeof ADMIN_ROLES)[number])) {
    return null;
  }
  return session;
}

// --- Schemas ---
const updateParentSchema = z.object({
  parentId: z.string().uuid(),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email("Invalid email address"),
});

// --- Actions ---

export async function updateParentAction(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, message: "Unauthorised" };

  const parsed = updateParentSchema.safeParse({
    parentId: formData.get("parentId"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || null,
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Validation error" };
  }

  const { parentId, fullName, phone, email } = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();

    // Email conflict check
    const { data: existing } = await supabaseAdmin
      .from("parents")
      .select("email")
      .eq("id", parentId)
      .single();

    if (existing && existing.email !== email) {
      const { data: conflict } = await supabaseAdmin
        .from("parents")
        .select("id")
        .eq("email", email)
        .neq("id", parentId)
        .maybeSingle();

      if (conflict) {
        return { success: false, message: `Email "${email}" is already in use.` };
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(parentId, { email });
      if (authError) {
        return { success: false, message: `Failed to update email: ${authError.message}` };
      }
    }

    const { error } = await supabase
      .from("parents")
      .update({ full_name: fullName, phone_number: phone, email })
      .eq("id", parentId);

    if (error) throw error;

    revalidatePath("/admin/parents");
    return { success: true, message: `${fullName} updated successfully.` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed";
    return { success: false, message };
  }
}

export async function deleteParentAction(
  parentId: string,
): Promise<ActionResult> {
  if (!(await requireAdmin())) return { success: false, message: "Unauthorised" };

  try {
    // 1. Prevent deletion if linked to students
    const { count } = await supabaseAdmin
      .from("student_parents")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", parentId);

    if ((count ?? 0) > 0) {
      return {
        success: false,
        message: `Cannot delete — this parent has ${count} enrolled child${count !== 1 ? "ren" : ""}. Remove student links first.`,
      };
    }

    // 2. Get email for success message
    const { data: parent } = await supabaseAdmin
      .from("parents")
      .select("email")
      .eq("id", parentId)
      .single();

    if (!parent) return { success: false, message: "Parent not found." };

    // 3. Delete from public tables
    const supabase = await createSupabaseServerClient();
    await supabase.from("parents").delete().eq("id", parentId);
    await supabase.from("profiles").delete().eq("id", parentId);

    // 4. Delete Auth User with retry
    let deleted = false;
    for (let i = 0; i < 3; i++) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(parentId);

      if (!authError) {
        deleted = true;
        break;
      }

      console.warn(`Auth delete attempt ${i + 1} failed:`, authError.message);
      await new Promise((r) => setTimeout(r, 600));
    }

    if (!deleted) {
      console.error(`⚠️ Could not delete auth user ${parentId} after retries`);
    }

    revalidatePath("/admin/parents");
    return {
      success: true,
      message: `Parent account (${parent.email}) has been permanently deleted.`,
    };
  } catch (err: unknown) {
    console.error("[deleteParentAction] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to delete parent account.";
    return {
      success: false,
      message,
    };
  }
}

export async function resetParentPasswordAction(
  parentId: string,
): Promise<ActionResult & { link?: string }> {
  if (!(await requireAdmin())) return { success: false, message: "Unauthorised" };

  const { data: parent, error: pErr } = await supabaseAdmin
    .from("parents")
    .select("email, full_name")
    .eq("id", parentId)
    .single();

  if (pErr || !parent) return { success: false, message: "Parent not found." };

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: parent.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm` },
  });

  if (linkErr) return { success: false, message: linkErr.message };

  await supabaseAdmin
    .from("parents")
    .update({ last_invite_sent: new Date().toISOString() })
    .eq("id", parentId);

  revalidatePath("/admin/parents");

  return {
    success: true,
    message: "Password reset link generated.",
    link: linkData.properties.action_link,
  };
}

// Export function remains unchanged
export async function fetchParentsForExport(): Promise<{
  success: boolean;
  data: ParentExportData[];
  message?: string;
}> {
  if (!(await requireAdmin())) return { success: false, data: [], message: "Unauthorised" };

  const { data, error } = await supabaseAdmin
    .from("parents")
    .select(`
      full_name, email, phone_number, invite_accepted, created_at,
      student_parents ( students ( full_name, current_grade ) )
    `)
    .order("full_name")
    .returns<RawParentExportRow[]>();

  if (error) return { success: false, data: [], message: error.message };

  const formattedData: ParentExportData[] = (data ?? []).map((p) => ({
    full_name: p.full_name,
    email: p.email,
    phone_number: p.phone_number ?? "",
    invite_accepted: p.invite_accepted ?? false,
    created_at: p.created_at,
    children: p.student_parents
      .map((sp) => sp.students)
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => `${s.full_name} (${s.current_grade})`)
      .join("; "),
  }));

  return { success: true, data: formattedData };
}

// Keep your other helper actions as they are
export async function getParentFeeBalancesAction(childIds: string[], academicYear = 2026) {
  const { fetchParentFeeBalances } = await import("@/lib/data/parents");
  return fetchParentFeeBalances(childIds, academicYear);
}

export async function getParentNotificationHistoryAction(childIds: string[], limit = 5) {
  const { fetchParentNotificationHistory } = await import("@/lib/data/parents");
  return fetchParentNotificationHistory(childIds, limit);
}