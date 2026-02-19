"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/lib/types/auth";
import { resetPasswordAction } from "@/lib/actions/auth";
import { AuthLayout } from "./AuthLayout";

const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-10 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:bg-white/8";

interface StrengthRule {
  label: string;
  test: (v: string) => boolean;
}

const STRENGTH_RULES: StrengthRule[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "Uppercase letter (A–Z)", test: (v) => /[A-Z]/.test(v) },
  { label: "Number (0–9)", test: (v) => /[0-9]/.test(v) },
  { label: "Special character (!@#...)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function ResetPasswordForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const passwordValue = watch("password", "");

  const onSubmit = (values: ResetPasswordFormValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("password", values.password);
      fd.append("confirmPassword", values.confirmPassword);

      const result = await resetPasswordAction(fd);

      if (!result.success) {
        setError("root", { message: result.message });
        return;
      }

      setDone(true);
      toast.success("Password updated!", {
        description: "You can now sign in with your new password.",
        duration: 4000,
      });
      setTimeout(() => router.push("/login"), 2500);
    });
  };

  return (
    <AuthLayout
      title="Set new password"
      subtitle="Choose a strong password for your account"
    >
      {done ? (
        <div className="space-y-5 text-center">
          <div className="flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/10 border border-emerald-400/25">
              <CheckCircle2 className="h-7 w-7 text-emerald-400" />
            </div>
          </div>
          <div>
            <p className="font-semibold text-white mb-2">Password updated</p>
            <p className="text-sm text-white/50">Redirecting you to sign in…</p>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="space-y-5"
        >
          {errors.root && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400 flex-shrink-0" />
              {errors.root.message}
            </div>
          )}

          {/* New password */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">
              New password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••••••"
                className={INPUT_CLS}
                disabled={isPending}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-rose-400">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Strength checklist */}
          {passwordValue.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 space-y-2">
              {STRENGTH_RULES.map(({ label, test }) => {
                const passed = test(passwordValue);
                return (
                  <div key={label} className="flex items-center gap-2">
                    {passed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-white/20 flex-shrink-0" />
                    )}
                    <span
                      className={`text-xs ${passed ? "text-emerald-400" : "text-white/35"}`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Confirm password */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">
              Confirm new password
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••••••"
                className={INPUT_CLS}
                disabled={isPending}
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                tabIndex={-1}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1.5 text-xs text-rose-400">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="group relative w-full overflow-hidden rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 px-6 py-3.5 text-sm font-bold text-[#0c0f1a] flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 mt-1"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Updating password…
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" /> Set new password
              </>
            )}
            <span className="absolute inset-0 -skew-x-12 translate-x-[-200%] bg-white/20 transition-transform duration-500 group-hover:translate-x-[200%]" />
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
