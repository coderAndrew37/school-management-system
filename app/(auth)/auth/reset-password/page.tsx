"use client";

/**
 * /app/auth/reset-password/page.tsx
 *
 * Called after /auth/confirm establishes a session from the invite link.
 * The parent is already authenticated here — they just have no password yet.
 * On success: redirects directly to /parent/portal (no second login required).
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { resetPasswordSchema } from "@/lib/types/auth";
import type { z } from "zod";
import { resetPasswordAction } from "@/lib/actions/auth";
import {
  Loader2,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

type ResetFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const password = watch("password", "");

  useEffect(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    setStrength(score);
  }, [password]);

  const onSubmit = async (data: ResetFormData) => {
    const formData = new FormData();
    formData.append("password", data.password);
    formData.append("confirmPassword", data.confirmPassword);

    const result = await resetPasswordAction(formData);

    if (result.success) {
      toast.success("Welcome to Kibali Academy! 🎓", {
        description:
          "Your password has been set. Taking you to your dashboard…",
        duration: 3000,
      });
      // Small delay so the toast is visible before navigation
      await new Promise((r) => setTimeout(r, 1200));
      router.push(result.redirectTo ?? "/parent/portal");
    } else {
      toast.error("Setup Failed", { description: result.message });
    }
  };

  const strengthColor =
    strength <= 1
      ? "bg-red-400"
      : strength === 2
        ? "bg-orange-400"
        : strength === 3
          ? "bg-amber-400"
          : "bg-emerald-500";

  const strengthLabel =
    strength <= 1
      ? "Weak"
      : strength === 2
        ? "Fair"
        : strength === 3
          ? "Good"
          : "Strong";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50/30 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl shadow-slate-200/60 border border-slate-100">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <ShieldCheck className="h-9 w-9 text-amber-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900">
            Create Your Password
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Set a strong password to protect your Kibali Academy parent account.
            You'll use it every time you sign in.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* New Password */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                {...register("password")}
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-10 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                placeholder="••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Strength bar */}
            {password.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="flex h-1.5 w-full gap-1">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-full flex-1 rounded-full transition-all duration-300 ${
                        strength >= step ? strengthColor : "bg-slate-100"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-slate-400">
                  Strength:{" "}
                  <span className="font-semibold text-slate-600">
                    {strengthLabel}
                  </span>
                </p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {[
                    { label: "8+ characters", met: password.length >= 8 },
                    { label: "Number", met: /[0-9]/.test(password) },
                    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
                    {
                      label: "Special character",
                      met: /[^A-Za-z0-9]/.test(password),
                    },
                  ].map(({ label, met }) => (
                    <li
                      key={label}
                      className={`flex items-center gap-1 text-[11px] ${met ? "text-emerald-600" : "text-slate-400"}`}
                    >
                      {met ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {errors.password && (
              <p className="text-xs text-red-500 font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                {...register("confirmPassword")}
                type={showPassword ? "text" : "password"}
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-500 font-medium">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || strength < 2}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-amber-200"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Setting password…
              </>
            ) : (
              "Set Password & Continue →"
            )}
          </button>
        </form>

        {/* Fallback help */}
        <p className="text-center text-xs text-slate-400 leading-relaxed">
          Having trouble? Contact the school office and ask them to resend your
          invite link, or visit in person for assistance.
        </p>
      </div>
    </div>
  );
}
