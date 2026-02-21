"use client";

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

  // Calculate password strength
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
      toast.success("Account Secured!", {
        description: "Your password has been updated. Redirecting to login...",
      });
      setTimeout(() => {
        router.push(result.redirectTo || "/login");
      }, 2500);
    } else {
      toast.error("Update Failed", {
        description: result.message,
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl shadow-slate-200/50">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-900">
            Set Password
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Create a strong password to protect your Kibali Academy portal.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <div className="space-y-4">
            {/* New Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-10 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  placeholder="••••••••"
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

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex h-1.5 w-full gap-1 overflow-hidden rounded-full bg-slate-100">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-full flex-1 transition-all duration-500 ${
                          strength >= step
                            ? strength <= 2
                              ? "bg-red-400"
                              : strength === 3
                                ? "bg-amber-400"
                                : "bg-emerald-500"
                            : "bg-transparent"
                        }`}
                      />
                    ))}
                  </div>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <li
                      className={`flex items-center text-[11px] ${password.length >= 8 ? "text-emerald-600" : "text-slate-400"}`}
                    >
                      {password.length >= 8 ? (
                        <Check className="mr-1 h-3 w-3" />
                      ) : (
                        <X className="mr-1 h-3 w-3" />
                      )}{" "}
                      8+ characters
                    </li>
                    <li
                      className={`flex items-center text-[11px] ${/[0-9]/.test(password) ? "text-emerald-600" : "text-slate-400"}`}
                    >
                      {/[0-9]/.test(password) ? (
                        <Check className="mr-1 h-3 w-3" />
                      ) : (
                        <X className="mr-1 h-3 w-3" />
                      )}{" "}
                      Includes number
                    </li>
                  </ul>
                </div>
              )}

              {errors.password && (
                <p className="text-xs font-medium text-red-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  {...register("confirmPassword")}
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 outline-none transition-all focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  placeholder="••••••••"
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs font-medium text-red-500">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || strength < 2}
            className="group relative flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              "Complete Setup"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
