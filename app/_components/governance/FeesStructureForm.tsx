"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, ChevronDown, Loader2 } from "lucide-react";

import { fsSchema, type FsValues } from "./fees.schemas";
import { cn, fieldBase } from "./fees.utils";
import type { Class } from "@/lib/types/allocation";
import { formatClassName } from "@/lib/types/allocation";

interface Props {
  classes: Class[];
  isPending: boolean;
  onSubmit: (values: FsValues) => void;
}

const FEE_FIELDS: { name: keyof FsValues; label: string; id: string }[] = [
  { name: "tuition_fee",   label: "Tuition (KES) *", id: "fs_tuition_fee" },
  { name: "activity_fee",  label: "Activity Fee",    id: "fs_activity_fee" },
  { name: "lunch_fee",     label: "Lunch Fee",       id: "fs_lunch_fee" },
  { name: "transport_fee", label: "Transport Fee",   id: "fs_transport_fee" },
  { name: "other_fee",     label: "Other Fee",       id: "fs_other_fee" },
];

export function FeeStructureForm({ classes, isPending, onSubmit }: Props) {
  const form = useForm<FsValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(fsSchema) as any,
    defaultValues: {
      class_id: classes[0]?.id ?? "",
      term: 1,
      tuition_fee: 0,
      activity_fee: 0,
      lunch_fee: 0,
      transport_fee: 0,
      other_fee: 0,
      notes: "",
    },
  });

  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <div className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/70 flex items-center gap-2 mb-4">
        <Banknote className="h-3.5 w-3.5" />
        Fee Structure
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {/* Class */}
        <div>
          <label htmlFor="fs_class_id" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            Class *
          </label>
          <div className="relative">
            <select
              id="fs_class_id"
              aria-label="Select class"
              className={cn(fieldBase, "appearance-none")}
              {...register("class_id")}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClassName(c)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          </div>
          {errors.class_id && (
            <p className="mt-1 text-xs text-rose-400">{errors.class_id.message}</p>
          )}
        </div>

        {/* Term */}
        <div>
          <label htmlFor="fs_term" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            Term *
          </label>
          <div className="relative">
            <select id="fs_term" aria-label="Select term" className={cn(fieldBase, "appearance-none")} {...register("term")}>
              {[1, 2, 3].map((t) => (
                <option key={t} value={t}>Term {t}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          </div>
        </div>

        {/* Fee fields */}
        {FEE_FIELDS.map((f) => (
          <div key={f.name}>
            <label htmlFor={f.id} className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
              {f.label}
            </label>
            <input
              id={f.id}
              aria-label={f.label}
              type="number"
              step="0.01"
              className={fieldBase}
              {...register(f.name)}
            />
          </div>
        ))}

        {/* Notes */}
        <div className="sm:col-span-2">
          <label htmlFor="fs_notes" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            Notes
          </label>
          <input
            id="fs_notes"
            aria-label="Fee structure notes"
            placeholder="Optional notes"
            className={fieldBase}
            {...register("notes")}
          />
        </div>

        {/* Submit */}
        <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition-all"
          >
            {isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Banknote className="h-4 w-4" />
            }
            Save Structure
          </button>
        </div>
      </form>
    </div>
  );
}