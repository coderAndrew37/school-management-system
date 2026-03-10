"use server";

// lib/actions/bulk-invite.ts
// Bulk parent invite management — resend, filter, batch operations

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/actions/auth";
import { sendWelcomeEmail } from "@/lib/mail";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface ParentInviteRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  last_invite_sent: string | null;
  confirmed: boolean; // whether auth user has confirmed email
  children: {
    id: string;
    full_name: string;
    current_grade: string;
  }[];
}

// ── Fetch all parents with invite status ──────────────────────────────────────

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
    .select(
      `
      id, full_name, email, phone_number, last_invite_sent,
      student_parents (
        students ( id, full_name, current_grade )
      )
    `,
    )
    .order("full_name");

  if (error) return { parents: [], error: error.message };

  // Fetch auth users to determine confirmation status
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });
  const confirmedSet = new Set<string>(
    (authList?.users ?? [])
      .filter((u) => u.email_confirmed_at)
      .map((u) => u.email!),
  );

  const rows: ParentInviteRow[] = (parents ?? []).map((p: any) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    phone_number: p.phone_number,
    last_invite_sent: p.last_invite_sent,
    confirmed: confirmedSet.has(p.email),
    children: (p.student_parents ?? [])
      .map((sp: any) => sp.students)
      .filter(Boolean),
  }));

  return { parents: rows };
}

// ── Resend invite to a single parent ─────────────────────────────────────────

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
      .select(
        `
        email, full_name,
        student_parents ( students ( full_name, current_grade ) )
      `,
      )
      .eq("id", parentId)
      .single();

    if (pErr || !parent) throw new Error("Parent not found");

    const { data: linkData, error: linkErr } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: (parent as any).email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
        },
      });

    if (linkErr) throw linkErr;

    const firstChild = ((parent as any).student_parents as any[])?.[0]
      ?.students;

    await sendWelcomeEmail({
      parentEmail: (parent as any).email,
      parentName: (parent as any).full_name,
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
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Bulk resend to all pending (unconfirmed) parents ─────────────────────────

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
    if (result.success) sent++;
    else {
      failed++;
      if (result.error) errors.push(result.error);
    }
    // Rate-limit: small delay between emails
    await new Promise((r) => setTimeout(r, 200));
  }

  return { success: failed === 0, sent, failed, errors };
}
