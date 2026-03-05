"use server";
// ─────────────────────────────────────────────────────────────────────────────
// lib/actions/governance.ts  – All governance Server Actions
// ─────────────────────────────────────────────────────────────────────────────
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import type { TransactionType } from "@/lib/types/governance";

export interface ActionResult {
  success: boolean;
  message: string;
  id?: string;
}

const REVALIDATE = "/admin/governance";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") {
    throw new Error("Forbidden: admin access required");
  }
  return session.user.id;
}

const str = (fd: FormData, k: string): string | null => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const num = (fd: FormData, k: string): number | null => {
  const v = fd.get(k);
  const n = parseFloat(v as string);
  return isNaN(n) ? null : n;
};

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────

export async function createAnnouncementAction(
  fd: FormData,
): Promise<ActionResult> {
  const authorId = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const schema = z.object({
    title: z.string().min(2).max(200),
    body: z.string().min(10).max(10000),
    audience: z.enum(["all", "parents", "teachers", "grade"]),
    target_grade: z.string().nullable().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]),
    pinned: z.boolean(),
    expires_at: z.string().nullable().optional(),
  });

  const parsed = schema.safeParse({
    title: str(fd, "title"),
    body: str(fd, "body"),
    audience: str(fd, "audience") ?? "all",
    target_grade: str(fd, "target_grade"),
    priority: str(fd, "priority") ?? "normal",
    pinned: fd.get("pinned") === "on" || fd.get("pinned") === "true",
    expires_at: str(fd, "expires_at"),
  });
  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0]!.message };

  const { data, error } = await supabase
    .from("announcements")
    .insert({ ...parsed.data, author_id: authorId })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    return { success: false, message: "Failed to publish announcement." };
  }
  revalidatePath(REVALIDATE);
  return { success: true, message: "Announcement published.", id: data.id };
}

export async function deleteAnnouncementAction(
  id: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { success: false, message: "Failed to delete." };
  revalidatePath(REVALIDATE);
  return { success: true, message: "Announcement deleted." };
}

export async function togglePinAction(
  id: string,
  currentlyPinned: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("announcements")
    .update({ pinned: !currentlyPinned })
    .eq("id", id);
  if (error) return { success: false, message: "Failed to update." };
  revalidatePath(REVALIDATE);
  return {
    success: true,
    message: currentlyPinned ? "Unpinned." : "Pinned to top.",
  };
}

// ── SCHOOL EVENTS ─────────────────────────────────────────────────────────────

export async function createEventAction(fd: FormData): Promise<ActionResult> {
  const authorId = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const schema = z.object({
    title: z.string().min(2).max(200),
    description: z.string().max(2000).nullable().optional(),
    category: z.enum([
      "academic",
      "sports",
      "cultural",
      "holiday",
      "meeting",
      "other",
    ]),
    start_date: z.string().min(1, "Start date required"),
    end_date: z.string().nullable().optional(),
    start_time: z.string().nullable().optional(),
    end_time: z.string().nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    is_public: z.boolean(),
  });

  const parsed = schema.safeParse({
    title: str(fd, "title"),
    description: str(fd, "description"),
    category: str(fd, "category") ?? "other",
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    start_time: str(fd, "start_time"),
    end_time: str(fd, "end_time"),
    location: str(fd, "location"),
    is_public: fd.get("is_public") !== "false",
  });
  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0]!.message };

  const { data, error } = await supabase
    .from("school_events")
    .insert({ ...parsed.data, author_id: authorId })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    return { success: false, message: "Failed to create event." };
  }
  revalidatePath(REVALIDATE);
  return { success: true, message: "Event added to calendar.", id: data.id };
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("school_events").delete().eq("id", id);
  if (error) return { success: false, message: "Failed to delete event." };
  revalidatePath(REVALIDATE);
  return { success: true, message: "Event removed." };
}

// ── INVENTORY ─────────────────────────────────────────────────────────────────

export async function createInventoryItemAction(
  fd: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const schema = z.object({
    name: z.string().min(2).max(200),
    description: z.string().max(1000).nullable().optional(),
    category: z.enum([
      "furniture",
      "electronics",
      "sports",
      "stationery",
      "laboratory",
      "books",
      "kitchen",
      "medical",
      "maintenance",
      "other",
    ]),
    sku: z.string().max(100).nullable().optional(),
    unit: z.string().min(1).max(50),
    quantity: z.number().int().min(0),
    minimum_stock: z.number().int().min(0),
    unit_cost: z.number().min(0).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    condition: z.enum(["new", "good", "fair", "poor", "condemned"]),
    supplier: z.string().max(200).nullable().optional(),
  });

  const openingQty = num(fd, "quantity") ?? 0;

  const parsed = schema.safeParse({
    name: str(fd, "name"),
    description: str(fd, "description"),
    category: str(fd, "category") ?? "other",
    sku: str(fd, "sku"),
    unit: str(fd, "unit") ?? "piece",
    quantity: 0, // always start at 0; use opening stock tx
    minimum_stock: num(fd, "minimum_stock") ?? 0,
    unit_cost: num(fd, "unit_cost"),
    location: str(fd, "location"),
    condition: str(fd, "condition") ?? "good",
    supplier: str(fd, "supplier"),
  });
  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0]!.message };

  const { data, error } = await supabase
    .from("inventory_items")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505")
      return {
        success: false,
        message: "An item with this SKU already exists.",
      };
    console.error(error);
    return { success: false, message: "Failed to add inventory item." };
  }

  // Record opening stock as a transaction (DB trigger updates qty)
  if (openingQty > 0) {
    await supabase.from("inventory_transactions").insert({
      item_id: data.id,
      tx_type: "received",
      quantity: openingQty,
      balance_after: 0, // overwritten by DB AFTER trigger
      notes: "Opening stock",
    });
  }

  revalidatePath(REVALIDATE);
  return { success: true, message: "Item added to inventory.", id: data.id };
}

export async function recordTransactionAction(
  fd: FormData,
): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const txType = str(fd, "tx_type") as TransactionType;
  const rawQty = num(fd, "quantity") ?? 0;
  const outgoing: TransactionType[] = ["issued", "damaged", "disposed"];
  const signedQty = outgoing.includes(txType)
    ? -Math.abs(rawQty)
    : Math.abs(rawQty);

  const schema = z.object({
    item_id: z.string().uuid(),
    tx_type: z.enum([
      "received",
      "issued",
      "returned",
      "damaged",
      "disposed",
      "audited",
    ]),
    quantity: z.number().int().min(1, "Quantity must be at least 1"),
    notes: z.string().max(500).nullable().optional(),
    reference: z.string().max(100).nullable().optional(),
  });

  const parsed = schema.safeParse({
    item_id: str(fd, "item_id"),
    tx_type: txType,
    quantity: Math.abs(rawQty),
    notes: str(fd, "notes"),
    reference: str(fd, "reference"),
  });
  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0]!.message };

  // Guard: outgoing must not exceed current stock
  if (outgoing.includes(txType)) {
    const { data: item } = await supabase
      .from("inventory_items")
      .select("quantity, name")
      .eq("id", parsed.data.item_id)
      .single();

    if (item && item.quantity + signedQty < 0) {
      return {
        success: false,
        message: `Only ${item.quantity} ${item.name} in stock — cannot remove ${Math.abs(signedQty)}.`,
      };
    }
  }

  const { error } = await supabase.from("inventory_transactions").insert({
    item_id: parsed.data.item_id,
    tx_type: txType,
    quantity: signedQty,
    balance_after: 0, // overwritten by AFTER trigger
    notes: parsed.data.notes,
    reference: parsed.data.reference,
    performed_by: userId,
  });

  if (error) {
    console.error(error);
    return { success: false, message: "Failed to record transaction." };
  }
  revalidatePath(REVALIDATE);
  return { success: true, message: "Stock movement recorded." };
}

// ── FEE STRUCTURES ────────────────────────────────────────────────────────────

export async function upsertFeeStructureAction(
  fd: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const schema = z.object({
    grade: z.string().min(1),
    term: z.number().int().min(1).max(3),
    academic_year: z.number().int(),
    tuition_fee: z.number().min(0),
    activity_fee: z.number().min(0),
    lunch_fee: z.number().min(0),
    transport_fee: z.number().min(0),
    other_fee: z.number().min(0),
    notes: z.string().max(500).nullable().optional(),
  });

  const parsed = schema.safeParse({
    grade: str(fd, "grade"),
    term: num(fd, "term"),
    academic_year: num(fd, "academic_year") ?? 2026,
    tuition_fee: num(fd, "tuition_fee") ?? 0,
    activity_fee: num(fd, "activity_fee") ?? 0,
    lunch_fee: num(fd, "lunch_fee") ?? 0,
    transport_fee: num(fd, "transport_fee") ?? 0,
    other_fee: num(fd, "other_fee") ?? 0,
    notes: str(fd, "notes"),
  });
  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0]!.message };

  const { data, error } = await supabase
    .from("fee_structures")
    .upsert(parsed.data, { onConflict: "grade,term,academic_year" })
    .select("id")
    .single();

  if (error) {
    console.error(error);
    return { success: false, message: "Failed to save fee structure." };
  }
  revalidatePath(REVALIDATE);
  return { success: true, message: "Fee structure saved.", id: data?.id };
}

// ── FEE PAYMENTS ──────────────────────────────────────────────────────────────

export async function recordPaymentAction(fd: FormData): Promise<ActionResult> {
  const userId = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const schema = z.object({
    student_id: z.string().uuid("Student is required"),
    term: z.number().int().min(1).max(3),
    academic_year: z.number().int(),
    amount_due: z.number().min(0),
    amount_paid: z.number().min(0),
    payment_method: z
      .enum(["mpesa", "bank_transfer", "cash", "cheque", "other"])
      .nullable()
      .optional(),
    mpesa_code: z.string().max(30).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  });

  const parsed = schema.safeParse({
    student_id: str(fd, "student_id"),
    term: num(fd, "term"),
    academic_year: num(fd, "academic_year") ?? 2026,
    amount_due: num(fd, "amount_due") ?? 0,
    amount_paid: num(fd, "amount_paid") ?? 0,
    payment_method: str(fd, "payment_method"),
    mpesa_code: str(fd, "mpesa_code"),
    notes: str(fd, "notes"),
  });
  if (!parsed.success)
    return { success: false, message: parsed.error.issues[0]!.message };

  const { data, error } = await supabase
    .from("fee_payments")
    .upsert(
      { ...parsed.data, recorded_by: userId },
      { onConflict: "student_id,term,academic_year" },
    )
    .select("id")
    .single();

  if (error) {
    console.error(error);
    return { success: false, message: "Failed to record payment." };
  }
  revalidatePath(REVALIDATE);
  return { success: true, message: "Payment recorded.", id: data?.id };
}

// ── ATTENDANCE OVERVIEW (server action wrapper for client components) ──────────

import type { AttendanceOverview } from "@/lib/types/governance";
import { fetchAttendanceOverview as _fetchAttendanceOverview } from "@/lib/data/governance";

export async function getAttendanceOverviewAction(
  date?: string,
): Promise<AttendanceOverview> {
  await requireAdmin();
  return _fetchAttendanceOverview(date);
}
