"use server";

// lib/actions/bulk-invite.ts
// Bulk parent invite management — resend, filter, batch operations

import { getSession } from "@/lib/actions/auth";
import { sendWelcomeEmail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../supabase/admin";

// ── 1. Types & Row Interfaces ─────────────────────────────────────────────────

export interface ParentInviteRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  last_invite_sent: string | null;
  confirmed: boolean;
  children: {
    id: string;
    full_name: string;
    current_grade: string;
  }[];
}

interface RawInviteStatusRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  last_invite_sent: string | null;
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

// ── 2. Fetch all parents with invite status ──────────────────────────────────────

export async function fetchParentsInviteStatus(): Promise<{
  parents: ParentInviteRow[];
  error?: string;
}> {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    return { parents: [], error: "Unauthorized" };
  }

  // Fetch parents with their children
  const { data: parents, error } = await supabaseAdmin
    .from("parents")
    .select(`
      id, full_name, email, phone_number, last_invite_sent,
      student_parents (
        students ( id, full_name, current_grade )
      )
    `)
    .order("full_name")
    .returns<RawInviteStatusRow[]>();

  if (error) return { parents: [], error: error.message };

  // Fetch auth users to determine confirmation status
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });
  
  const confirmedSet = new Set<string>(
    (authList?.users ?? [])
      .filter((u) => u.email_confirmed_at)
      .map((u) => u.email!)
  );

  const rows: ParentInviteRow[] = (parents ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    phone_number: p.phone_number,
    last_invite_sent: p.last_invite_sent,
    confirmed: confirmedSet.has(p.email),
    children: (p.student_parents ?? [])
      .map((sp) => sp.students)
      .filter((s): s is NonNullable<typeof s> => !!s),
  }));

  return { parents: rows };
}

// ── 3. Resend invite to a single parent ─────────────────────────────────────────

export async function resendParentInviteAction(parentId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const { data: parent, error: pErr } = await supabaseAdmin
      .from("parents")
      .select(`
        email, full_name,
        student_parents ( students ( full_name, current_grade ) )
      `)
      .eq("id", parentId)
      .single();

    if (pErr || !parent) throw new Error("Parent not found");
    
    const typedParent = parent as unknown as RawResendInviteRow;

    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: typedParent.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
        },
      });

    if (linkErr) throw linkErr;

    const firstChild = typedParent.student_parents?.[0]?.students;

    await sendWelcomeEmail({
      parentEmail: typedParent.email,
      parentName: typedParent.full_name,
      studentName: firstChild?.full_name ?? "your child",
      grade: firstChild?.current_grade ?? "—",
      setupLink: linkData.properties.action_link,
    });

    // Update last_invite_sent timestamp
    await supabaseAdmin
      .from("parents")
      .update({ last_invite_sent: new Date().toISOString() })
      .eq("id", parentId);

    revalidatePath("/admin/invites");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to resend invite";
    return { success: false, error: msg };
  }
}

// ── 4. Bulk resend to specific parents ─────────────────────────

export async function bulkResendInvitesAction(parentIds: string[]): Promise<{
  success: boolean;
  sent: number;
  failed: number;
  errors: string[];
}> {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    return {
      success: false,
      sent: 0,
      failed: parentIds.length,
      errors: ["Unauthorized"],
    };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const parentId of parentIds) {
    const result = await resendParentInviteAction(parentId);
    if (result.success) {
      sent++;
    } else {
      failed++;
      if (result.error) errors.push(`${parentId}: ${result.error}`);
    }
    // Rate-limit to prevent hitting SMTP or Auth API limits
    await new Promise((r) => setTimeout(r, 200));
  }

  return { success: failed === 0, sent, failed, errors };
}