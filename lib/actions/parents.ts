"use server";

// lib/actions/parents.ts
// Admin-side parent management actions.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/actions/auth";

const ADMIN_ROLES = ["admin", "superadmin"] as const;

async function requireAdmin() {
  const session = await getSession();
  if (
    !session ||
    !(ADMIN_ROLES as readonly string[]).includes(session.profile.role)
  )
    return null;
  return session;
}

interface ActionResult {
  success: boolean;
  message: string;
}

// ── Update parent details ─────────────────────────────────────────────────────

const updateParentSchema = z.object({
  parentId: z.string().uuid(),
  fullName: z.string().min(2).max(120),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email("Invalid email address"),
});

export async function updateParentAction(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  const parsed = updateParentSchema.safeParse({
    parentId: formData.get("parentId"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone") || null,
    email: formData.get("email"),
  });

  if (!parsed.success)
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Validation error",
    };

  const { parentId, fullName, phone, email } = parsed.data;

  // If email is changing, update the auth user email too
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabaseAdmin
    .from("parents")
    .select("email")
    .eq("id", parentId)
    .single();

  if (existing && existing.email !== email) {
    // Check no other parent already has this email
    const { data: conflict } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("email", email)
      .neq("id", parentId)
      .maybeSingle();

    if (conflict)
      return {
        success: false,
        message: `Email "${email}" is already in use by another parent.`,
      };

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      parentId,
      { email },
    );
    if (authError)
      return {
        success: false,
        message: `Could not update email: ${authError.message}`,
      };
  }

  const { error } = await supabase
    .from("parents")
    .update({ full_name: fullName, phone_number: phone, email })
    .eq("id", parentId);

  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/parents");
  return { success: true, message: `${fullName} updated successfully.` };
}

// ── Delete parent ─────────────────────────────────────────────────────────────
// Guard: can only delete if the parent has no linked students.

export async function deleteParentAction(
  parentId: string,
): Promise<ActionResult> {
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  // Count linked children
  const { count } = await supabaseAdmin
    .from("student_parents")
    .select("*", { count: "exact", head: true })
    .eq("parent_id", parentId);

  if ((count ?? 0) > 0) {
    return {
      success: false,
      message: `Cannot delete — this parent has ${count} enrolled child${count !== 1 ? "ren" : ""}. Remove all student links first.`,
    };
  }

  // Delete auth user (cascades to parents row via FK or we delete manually)
  const { error: authError } =
    await supabaseAdmin.auth.admin.deleteUser(parentId);
  if (authError) {
    // Try deleting the row anyway if auth user was already gone
    console.warn("Auth user delete failed:", authError.message);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("parents").delete().eq("id", parentId);
  if (error) return { success: false, message: error.message };

  revalidatePath("/admin/parents");
  return { success: true, message: "Parent account deleted." };
}

// ── Reset parent password (generate new invite link) ─────────────────────────

export async function resetParentPasswordAction(
  parentId: string,
): Promise<ActionResult & { link?: string }> {
  if (!(await requireAdmin()))
    return { success: false, message: "Unauthorised" };

  const { data: parent, error: pErr } = await supabaseAdmin
    .from("parents")
    .select("email, full_name")
    .eq("id", parentId)
    .single();

  if (pErr || !parent) return { success: false, message: "Parent not found." };

  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: parent.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
      },
    });

  if (linkErr) return { success: false, message: linkErr.message };

  // Update last_invite_sent
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

// ── Export parents to CSV ─────────────────────────────────────────────────────
// Returns raw data — CSV building happens client-side to avoid streaming issues.

export async function fetchParentsForExport(): Promise<{
  success: boolean;
  data: {
    full_name: string;
    email: string;
    phone_number: string | null;
    invite_accepted: boolean;
    created_at: string;
    children: string; // comma-separated "Name (Grade)"
  }[];
  message?: string;
}> {
  if (!(await requireAdmin()))
    return { success: false, data: [], message: "Unauthorised" };

  const { data, error } = await supabaseAdmin
    .from("parents")
    .select(
      `
      full_name, email, phone_number, invite_accepted, created_at,
      student_parents ( students ( full_name, current_grade ) )
    `,
    )
    .order("full_name");

  if (error) return { success: false, data: [], message: error.message };

  return {
    success: true,
    data: (data ?? []).map((p: any) => ({
      full_name: p.full_name,
      email: p.email,
      phone_number: p.phone_number ?? "",
      invite_accepted: p.invite_accepted ?? false,
      created_at: p.created_at,
      children: (p.student_parents ?? [])
        .map((sp: any) => sp.students)
        .filter(Boolean)
        .map((s: any) => `${s.full_name} (${s.current_grade})`)
        .join("; "),
    })),
  };
}

// ── Data fetchers exposed as server actions ───────────────────────────────────
// The client component needs these lazily (on tab click) so they must be
// server actions, not direct imports from lib/data/parents (which uses
// next/headers and cannot be imported by client components).

export async function getParentFeeBalancesAction(
  childIds: string[],
  academicYear = 2026,
) {
  const { fetchParentFeeBalances } = await import("@/lib/data/parents");
  return fetchParentFeeBalances(childIds, academicYear);
}

export async function getParentNotificationHistoryAction(
  childIds: string[],
  limit = 5,
) {
  const { fetchParentNotificationHistory } = await import("@/lib/data/parents");
  return fetchParentNotificationHistory(childIds, limit);
}
