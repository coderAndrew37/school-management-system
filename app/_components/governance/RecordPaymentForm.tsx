"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, ChevronDown, Loader2, Receipt } from "lucide-react";

import { paySchema, type PayValues } from "./fees.schemas";
import { cn, fieldBase } from "./fees.utils";
import type { StudentSummary } from "@/lib/types/governance";

interface Props {
  students: StudentSummary[];
  isPending: boolean;
  onSubmit: (values: PayValues) => void;
}

export function RecordPaymentForm({ students, isPending, onSubmit }: Props) {
  const form = useForm<PayValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(paySchema) as any,
    defaultValues: {
      student_id: "",
      term: 1,
      payment_method: "mpesa",
      amount_due: 0,
      amount_paid: 0,
      mpesa_code: "",
      notes: "",
    },
  });

  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/70 flex items-center gap-2 mb-4">
        <Receipt className="h-3.5 w-3.5" />
        Record Fee Payment
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {/* Student */}
        <div>
          <label htmlFor="pay_student_id" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            Student *
          </label>
          <div className="relative">
            <select
              id="pay_student_id"
              aria-label="Select student"
              className={cn(fieldBase, "appearance-none")}
              {...register("student_id")}
            >
              <option value="">Select student…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.classes ? ` (${s.classes.grade}${s.classes.stream !== "Main" ? ` ${s.classes.stream}` : ""})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          </div>
          {errors.student_id && (
            <p className="mt-1 text-xs text-rose-400">{errors.student_id.message}</p>
          )}
        </div>

        {/* Term */}
        <div>
          <label htmlFor="pay_term" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            Term *
          </label>
          <div className="relative">
            <select id="pay_term" aria-label="Select term" className={cn(fieldBase, "appearance-none")} {...register("term")}>
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          </div>
        </div>

        {/* Amount Due */}
        <div>
          <label htmlFor="pay_amount_due" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            Amount Due (KES) *
          </label>
          <input
            id="pay_amount_due"
            aria-label="Amount due in KES"
            type="number"
            step="0.01"
            className={fieldBase}
            {...register("amount_due")}
          />
          {errors.amount_due && (
            <p className="mt-1 text-xs text-rose-400">{errors.amount_due.message}</p>
          )}
        </div>

        {/* Amount Paid */}
        <div>
          <label htmlFor="pay_amount_paid" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            Amount Paid (KES) *
          </label>
          <input
            id="pay_amount_paid"
            aria-label="Amount paid in KES"
            type="number"
            step="0.01"
            className={fieldBase}
            {...register("amount_paid")}
          />
        </div>

        {/* Payment Method */}
        <div>
          <label htmlFor="pay_payment_method" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            Payment Method
          </label>
          <div className="relative">
            <select
              id="pay_payment_method"
              aria-label="Select payment method"
              className={cn(fieldBase, "appearance-none")}
              {...register("payment_method")}
            >
              <option value="mpesa">📱 M-Pesa</option>
              <option value="bank_transfer">🏦 Bank Transfer</option>
              <option value="cash">💵 Cash</option>
              <option value="cheque">📄 Cheque</option>
              <option value="other">Other</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          </div>
        </div>

        {/* M-Pesa Code */}
        <div>
          <label htmlFor="pay_mpesa_code" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            M-Pesa Code
          </label>
          <input
            id="pay_mpesa_code"
            aria-label="M-Pesa transaction code"
            placeholder="e.g. QHX4K2..."
            className={cn(fieldBase, "font-mono")}
            {...register("mpesa_code")}
          />
        </div>

        {/* Notes */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="pay_notes" className="text-[10px] uppercase tracking-widest text-white/35 block mb-1">
            Notes
          </label>
          <input
            id="pay_notes"
            aria-label="Payment notes"
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
            className="flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white transition-all"
          >
            {isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Banknote className="h-4 w-4" />
            }
            Record Payment
          </button>
        </div>
      </form>
    </div>
  );
}