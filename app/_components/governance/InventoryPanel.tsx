"use client";

import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Package,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  ArrowDownToLine,
  Search,
  ChevronDown,
  Boxes,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import {
  createInventoryItemAction,
  recordTransactionAction,
} from "@/lib/actions/governance";

import type {
  InventoryItem,
  InventoryCategory,
  ItemCondition,
} from "@/lib/types/governance";

/** Utility for merging tailwind classes */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const itemSchema = z.object({
  name: z.string().min(2, "Name required").max(200),
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
  unit: z.string().min(1, "Unit required").max(50),
  quantity: z.preprocess(
    (val) => (val === "" ? 0 : val),
    z.coerce.number().int().min(0),
  ),
  minimum_stock: z.preprocess(
    (val) => (val === "" ? 0 : val),
    z.coerce.number().int().min(0),
  ),
  condition: z.enum(["new", "good", "fair", "poor", "condemned"]),
  sku: z
    .string()
    .max(100)
    .optional()
    .transform((v) => v || ""),
  unit_cost: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.coerce.number().min(0).optional(),
  ),
  location: z
    .string()
    .max(200)
    .optional()
    .transform((v) => v || ""),
  supplier: z
    .string()
    .max(200)
    .optional()
    .transform((v) => v || ""),
  description: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => v || ""),
});

// Use z.infer (output type) so SubmitHandler gets the post-transform types
type ItemValues = z.infer<typeof itemSchema>;

const txSchema = z.object({
  tx_type: z.enum([
    "received",
    "issued",
    "returned",
    "damaged",
    "disposed",
    "audited",
  ]),
  quantity: z.preprocess(
    (val) => (val === "" ? 1 : val),
    z.coerce.number().int().min(1, "Quantity must be at least 1"),
  ),
  notes: z
    .string()
    .max(500)
    .optional()
    .transform((v) => v || ""),
  reference: z
    .string()
    .max(100)
    .optional()
    .transform((v) => v || ""),
});

// Use z.infer (output type) so SubmitHandler gets the post-transform types
type TxValues = z.infer<typeof txSchema>;

// ── Constants ────────────────────────────────────────────────────────────────

const CONDITION_STYLE: Record<ItemCondition, string> = {
  new: "text-emerald-400 border-emerald-400/25 bg-emerald-400/10",
  good: "text-sky-400 border-sky-400/25 bg-sky-400/10",
  fair: "text-amber-400 border-amber-400/25 bg-amber-400/10",
  poor: "text-orange-400 border-orange-400/25 bg-orange-400/10",
  condemned: "text-rose-400 border-rose-400/25 bg-rose-400/10",
};

const CATEGORY_ICON: Record<InventoryCategory, string> = {
  furniture: "🪑",
  electronics: "💻",
  sports: "⚽",
  stationery: "✏️",
  laboratory: "🔬",
  books: "📚",
  kitchen: "🍳",
  medical: "🏥",
  maintenance: "🔧",
  other: "📦",
};

const CATEGORIES: InventoryCategory[] = [
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
];

const fieldBase =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20 disabled:opacity-50";

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  items: InventoryItem[];
}

export function InventoryPanel({ items }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [txTarget, setTxTarget] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<InventoryCategory | "all">("all");
  const [isPending, startTransition] = useTransition();

  const lowStock = useMemo(
    () => items.filter((i) => i.quantity <= i.minimum_stock),
    [items],
  );

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const q = search.toLowerCase();
      const matchText =
        i.name.toLowerCase().includes(q) ||
        (i.sku ?? "").toLowerCase().includes(q);
      const matchCat = catFilter === "all" || i.category === catFilter;
      return matchText && matchCat;
    });
  }, [items, search, catFilter]);

  // Form Hooks
  const itemForm = useForm<ItemValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(itemSchema) as any,
    defaultValues: {
      category: "other",
      unit: "piece",
      condition: "good",
      quantity: 0,
      minimum_stock: 0,
      sku: "",
      location: "",
      supplier: "",
      description: "",
      unit_cost: undefined,
    },
  });

  const txForm = useForm<TxValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(txSchema) as any,
    defaultValues: {
      tx_type: "received",
      quantity: 1,
      notes: "",
      reference: "",
    },
  });

  // Action Handlers
  const onAddItem = (values: ItemValues) => {
    startTransition(async () => {
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      const res = await createInventoryItemAction(fd);
      if (res.success) {
        toast.success("Item added", { icon: "📦" });
        itemForm.reset();
        setShowAdd(false);
      } else {
        toast.error("Failed", { description: res.message });
      }
    });
  };

  const onTransaction = (values: TxValues) => {
    if (!txTarget) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("item_id", txTarget.id);
      Object.entries(values).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
      });
      const res = await recordTransactionAction(fd);
      if (res.success) {
        toast.success(res.message);
        txForm.reset();
        setTxTarget(null);
      } else {
        toast.error("Failed", { description: res.message });
      }
    });
  };

  return (
    <div className="space-y-5">
      {lowStock.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">
              {lowStock.length} item{lowStock.length !== 1 ? "s" : ""} low on
              stock
            </p>
            <p className="text-xs text-amber-400/60 mt-0.5">
              {lowStock
                .slice(0, 4)
                .map((i) => i.name)
                .join(", ")}
              {lowStock.length > 4 ? ` +${lowStock.length - 4} more` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25 pointer-events-none" />
          <input
            aria-label="Search inventory"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU…"
            className={cn(fieldBase, "pl-9")}
          />
        </div>
        <div className="relative">
          <select
            aria-label="Filter by category"
            value={catFilter}
            onChange={(e) =>
              setCatFilter(e.target.value as InventoryCategory | "all")
            }
            className={cn(
              fieldBase,
              "appearance-none cursor-pointer min-w-[140px] pr-8",
            )}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_ICON[c]} {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-95 px-4 py-2.5 text-xs font-bold text-white transition-all flex-shrink-0"
        >
          {showAdd ? (
            <>
              <X className="h-3.5 w-3.5" /> Cancel
            </>
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" /> Add Item
            </>
          )}
        </button>
      </div>

      {/* Add Item Form */}
      {showAdd && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70 flex items-center gap-2 mb-4">
            <Package className="h-3.5 w-3.5" /> New Inventory Item
          </p>
          <form
            onSubmit={itemForm.handleSubmit(onAddItem)}
            noValidate
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div className="sm:col-span-2">
              <input
                aria-label="Item name"
                placeholder="Item name *"
                className={fieldBase}
                {...itemForm.register("name")}
              />
              {itemForm.formState.errors.name && (
                <p className="mt-1 text-xs text-rose-400">
                  {itemForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="relative">
              <select
                aria-label="Item category"
                className={cn(fieldBase, "appearance-none")}
                {...itemForm.register("category")}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_ICON[c]} {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            </div>
            <input
              aria-label="SKU"
              placeholder="SKU (optional)"
              className={fieldBase}
              {...itemForm.register("sku")}
            />
            <input
              aria-label="Unit"
              placeholder="Unit (e.g. piece, box)"
              className={fieldBase}
              {...itemForm.register("unit")}
            />
            <div>
              <input
                aria-label="Opening quantity"
                type="number"
                placeholder="Opening quantity"
                className={fieldBase}
                {...itemForm.register("quantity")}
              />
              {itemForm.formState.errors.quantity && (
                <p className="mt-1 text-xs text-rose-400">
                  {itemForm.formState.errors.quantity.message}
                </p>
              )}
            </div>
            <input
              aria-label="Minimum stock level"
              type="number"
              placeholder="Min stock level"
              className={fieldBase}
              {...itemForm.register("minimum_stock")}
            />
            <input
              aria-label="Unit cost in KES"
              type="number"
              step="0.01"
              placeholder="Unit cost (KES)"
              className={fieldBase}
              {...itemForm.register("unit_cost")}
            />
            <input
              aria-label="Storage location"
              placeholder="Location"
              className={fieldBase}
              {...itemForm.register("location")}
            />
            <div className="relative">
              <select
                aria-label="Item condition"
                className={cn(fieldBase, "appearance-none")}
                {...itemForm.register("condition")}
              >
                {["new", "good", "fair", "poor", "condemned"].map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            </div>
            <input
              aria-label="Supplier name"
              placeholder="Supplier (optional)"
              className={fieldBase}
              {...itemForm.register("supplier")}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <input
                aria-label="Item description"
                placeholder="Description (optional)"
                className={fieldBase}
                {...itemForm.register("description")}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition-all"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Package className="h-4 w-4" />
                )}
                Add to Inventory
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Boxes className="h-8 w-8 text-white/10 mb-3" />
            <p className="text-sm text-white/30">No items found</p>
          </div>
        ) : (
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-white/[0.04] border-b border-white/[0.07]">
              <tr>
                {[
                  "Item",
                  "Category",
                  "Stock / Min",
                  "Condition",
                  "Location",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-white/30"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filtered.map((item) => {
                const isLow = item.quantity <= item.minimum_stock;
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-white/[0.02] group transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-lg"
                          role="img"
                          aria-label={item.category}
                        >
                          {CATEGORY_ICON[item.category]}
                        </span>
                        <div>
                          <p className="font-medium text-white">{item.name}</p>
                          {item.sku && (
                            <p className="text-[10px] font-mono text-white/30">
                              {item.sku}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50 capitalize">
                      {item.category}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "font-bold tabular-nums",
                            isLow ? "text-amber-400" : "text-white",
                          )}
                        >
                          {item.quantity}
                        </span>
                        <span className="text-white/25 text-xs">
                          / {item.minimum_stock} {item.unit}
                        </span>
                        {isLow && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                          CONDITION_STYLE[item.condition],
                        )}
                      >
                        {item.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40">
                      {item.location ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        aria-label={`Record stock movement for ${item.name}`}
                        onClick={() => setTxTarget(item)}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-amber-400/10 text-white/40 hover:text-amber-400 text-xs font-medium transition-all"
                      >
                        <ArrowDownToLine className="h-3.5 w-3.5" /> Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Transaction Modal */}
      {txTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Stock movement for ${txTarget.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setTxTarget(null)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111827] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-white">Stock Movement</p>
              <button
                aria-label="Close stock movement dialog"
                onClick={() => {
                  setTxTarget(null);
                  txForm.reset();
                }}
                className="text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-white/50 mb-5">
              <span className="font-semibold text-white">{txTarget.name}</span>{" "}
              · Stock:{" "}
              <span className="text-amber-400 font-bold">
                {txTarget.quantity}
              </span>{" "}
              {txTarget.unit}
            </p>
            <form
              onSubmit={txForm.handleSubmit(onTransaction)}
              noValidate
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="tx_type"
                  className="text-[10px] uppercase tracking-widest text-white/35 block mb-1"
                >
                  Movement type *
                </label>
                <div className="relative">
                  <select
                    id="tx_type"
                    aria-label="Movement type"
                    className={cn(fieldBase, "appearance-none")}
                    {...txForm.register("tx_type")}
                  >
                    <option value="received">📥 Received (stock in)</option>
                    <option value="issued">📤 Issued (stock out)</option>
                    <option value="returned">↩️ Returned</option>
                    <option value="damaged">⚠️ Damaged / write-off</option>
                    <option value="disposed">🗑️ Disposed</option>
                    <option value="audited">📋 Stock audit / adjustment</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                </div>
              </div>
              <div>
                <label
                  htmlFor="tx_quantity"
                  className="text-[10px] uppercase tracking-widest text-white/35 block mb-1"
                >
                  Quantity *
                </label>
                <input
                  id="tx_quantity"
                  aria-label="Transaction quantity"
                  type="number"
                  placeholder="0"
                  className={fieldBase}
                  {...txForm.register("quantity")}
                />
                {txForm.formState.errors.quantity && (
                  <p className="mt-1 text-xs text-rose-400">
                    {txForm.formState.errors.quantity.message}
                  </p>
                )}
              </div>
              <input
                aria-label="Reference or LPO number"
                placeholder="Reference / LPO"
                className={fieldBase}
                {...txForm.register("reference")}
              />
              <input
                aria-label="Optional notes"
                placeholder="Optional notes"
                className={fieldBase}
                {...txForm.register("notes")}
              />
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setTxTarget(null);
                    txForm.reset();
                  }}
                  className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 py-2.5 text-sm font-bold text-[#0c0f1a] transition-all"
                >
                  {isPending && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
