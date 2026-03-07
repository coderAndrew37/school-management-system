"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Send, GraduationCap } from "lucide-react";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/lib/types/auth";
import { forgotPasswordAction } from "@/lib/actions/auth";

const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:bg-white/[0.08]";

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

  const onSubmit = (values: ForgotPasswordFormValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", values.email);
      const result = await forgotPasswordAction(fd);
      if (result.success) {
        setSubmitted(true);
      } else {
        toast.error("Request failed", { description: result.message });
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center p-4 font-[family-name:var(--font-body)]">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-blue-500/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-7">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
            <GraduationCap className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-400/70 leading-none">
              Kibali Academy
            </p>
            <p className="text-xs font-bold text-white/50 leading-none mt-0.5">
              School Portal
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/40">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />

          <div className="p-7">
            {submitted ? (
              // ── Success state ───────────────────────────────────────────────
              <div className="space-y-6 text-center py-2">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10 border border-emerald-400/25">
                    <Send className="h-7 w-7 text-emerald-400" />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="font-bold text-white text-base">
                    Check your inbox
                  </p>
                  <p className="text-sm text-white/50 leading-relaxed">
                    If{" "}
                    <span className="text-white/80 font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded">
                      {getValues("email")}
                    </span>{" "}
                    is registered, you'll receive a reset link within a few
                    minutes.
                  </p>
                  <p className="text-xs text-white/25 mt-1">
                    Don't see it? Check your spam or junk folder.
                  </p>
                </div>

                {/* School fallback — important for low-tech users */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left">
                  <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1">
                    Still having trouble?
                  </p>
                  <p className="text-xs text-white/30 leading-relaxed">
                    Visit the school office and ask a staff member to reset your
                    account. No email required.
                  </p>
                </div>

                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-amber-400/70 hover:text-amber-400 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to sign in
                </Link>
              </div>
            ) : (
              // ── Request form ────────────────────────────────────────────────
              <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="space-y-5"
              >
                <div>
                  <h1 className="text-lg font-bold text-white mb-1">
                    Reset your password
                  </h1>
                  <p className="text-sm text-white/40 leading-relaxed">
                    Enter the email address on your account and we'll send you a
                    secure reset link.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
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

                {/* School fallback */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1">
                    Don't have email access?
                  </p>
                  <p className="text-xs text-white/30 leading-relaxed">
                    Visit the school office with your ID and a staff member can
                    reset your account for you.
                  </p>
                </div>

                <div className="pt-1 border-t border-white/[0.06] text-center">
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
          </div>
        </div>
      </div>
    </div>
  );
}
