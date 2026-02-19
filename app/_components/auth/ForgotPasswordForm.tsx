"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/lib/types/auth";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { AuthLayout } from "./AuthLayout";

const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:bg-white/8";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = (_values: ForgotPasswordFormValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", _values.email);

      const result = await forgotPasswordAction(fd);

      if (result.success) {
        setSubmitted(true);
      } else {
        toast.error("Request failed", { description: result.message });
      }
    });
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll send a secure reset link to your email"
    >
      {submitted ? (
        // ── Success state ──────────────────────────────────────────────────
        <div className="space-y-6 text-center">
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10 border border-emerald-400/25">
              <Send className="h-7 w-7 text-emerald-400" />
            </div>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">Check your inbox</p>
            <p className="text-sm text-white/50 leading-relaxed">
              If{" "}
              <span className="text-white/80 font-mono">
                {getValues("email")}
              </span>{" "}
              is registered, you'll receive a reset link within a few minutes.
            </p>
            <p className="text-xs text-white/30 mt-3">
              Don't see it? Check your spam folder.
            </p>
          </div>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm text-amber-400/70 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      ) : (
        // ── Form ──────────────────────────────────────────────────────────
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5"
        >
          <p className="text-sm text-white/50 leading-relaxed">
            Enter the email address associated with your Kibali Academy account
            and we'll send you a secure link to reset your password.
          </p>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@kibali.ac.ke"
                className={INPUT_CLS}
                disabled={isPending}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-rose-400">
                {errors.email.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="group relative w-full overflow-hidden rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 px-6 py-3.5 text-sm font-bold text-[#0c0f1a] flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Send reset link
              </>
            )}
            <span className="absolute inset-0 -skew-x-12 translate-x-[-200%] bg-white/20 transition-transform duration-500 group-hover:translate-x-[200%]" />
          </button>

          <div className="pt-2 border-t border-white/[0.06] text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-amber-400/70 hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
