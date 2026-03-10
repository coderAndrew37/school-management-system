"use server";

// lib/actions/engagement.ts
// Admin publish/manage announcements and school events.
// Parents read via parent-data.ts (existing queries — no changes needed).

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/actions/auth";
import { z } from "zod";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function requireAdmin() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const announcementSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(5).max(2000),
  audience: z.enum(["all", "parents", "teachers", "students"]).default("all"),
  target_grade: z.string().nullable().optional(),
  priority: z.enum(["normal", "urgent"]).default("normal"),
  expires_at: z.string().nullable().optional(),
});

const eventSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(1000).nullable().optional(),
  start_date: z.string().min(1),
  end_date: z.string().nullable().optional(),
  audience: z.enum(["all", "parents", "teachers", "students"]).default("all"),
  target_grade: z.string().nullable().optional(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  target_grade: string | null;
  priority: string;
  expires_at: string | null;
  created_at: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  audience: string;
  target_grade: string | null;
  created_at: string;
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function fetchAnnouncementsAdmin(): Promise<Announcement[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select(
      "id, title, body, audience, target_grade, priority, expires_at, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[fetchAnnouncementsAdmin]", error.message);
    return [];
  }
  return (data ?? []) as Announcement[];
}

export async function createAnnouncementAction(
  input: z.infer<typeof announcementSchema>,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const { error } = await supabaseAdmin.from("announcements").insert({
    ...parsed.data,
    target_grade: parsed.data.target_grade || null,
    expires_at: parsed.data.expires_at || null,
    created_by: session.user.id,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/announcements");
  revalidatePath("/parent");
  return { success: true };
}

export async function deleteAnnouncementAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("announcements")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/announcements");
  revalidatePath("/parent");
  return { success: true };
}

// ── School Events ─────────────────────────────────────────────────────────────

export async function fetchEventsAdmin(): Promise<SchoolEvent[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("school_events")
    .select(
      "id, title, description, start_date, end_date, audience, target_grade, created_at",
    )
    .order("start_date", { ascending: true })
    .limit(100);
  if (error) {
    console.error("[fetchEventsAdmin]", error.message);
    return [];
  }
  return (data ?? []) as SchoolEvent[];
}

export async function createEventAction(
  input: z.infer<typeof eventSchema>,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const { error } = await supabaseAdmin.from("school_events").insert({
    ...parsed.data,
    description: parsed.data.description || null,
    end_date: parsed.data.end_date || null,
    target_grade: parsed.data.target_grade || null,
    created_by: session.user.id,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/events");
  revalidatePath("/parent");
  return { success: true };
}

export async function deleteEventAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("school_events")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/events");
  revalidatePath("/parent");
  return { success: true };
}
