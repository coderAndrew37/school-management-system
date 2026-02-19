"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, LogIn, Mail, Lock } from "lucide-react";
import { loginSchema, type LoginFormValues } from "@/lib/types/auth";
import { loginAction } from "@/lib/actions/auth";
import { AuthLayout } from "./AuthLayout";

interface LoginFormProps {
  redirectTo?: string;
  errorParam?: string;
}

const INPUT_CLS =
  "w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-200 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:bg-white/8";

export function LoginForm({ redirectTo, errorParam }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Show error from URL params (e.g. after failed PKCE callback)
  if (errorParam) {
    const errorMessages: Record<string, string> = {
      missing_code:
        "The sign-in link was invalid or expired. Please try again.",
      auth_error: "Authentication failed. Please try again.",
    };
    toast.error(errorMessages[errorParam] ?? "An error occurred.", {
      id: "url-error",
    });
  }

  const onSubmit = (values: LoginFormValues) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", values.email);
      fd.append("password", values.password);

      const result = await loginAction(fd);

      if (!result.success) {
        setError("root", { message: result.message });
        return;
      }

      toast.success("Welcome back!", { duration: 2000 });
      router.push(redirectTo ?? result.redirectTo ?? "/dashboard");
      router.refresh();
    });
  };

  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle="Kibali Academy School Management Portal"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Root error */}
        {errors.root && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-300 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400 flex-shrink-0" />
            {errors.root.message}
          </div>
        )}

        {/* Email */}
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

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/40">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-amber-400/70 hover:text-amber-400 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••"
              className={`${INPUT_CLS} pr-10`}
              disabled={isPending}
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
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

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="group relative w-full overflow-hidden rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 px-6 py-3.5 text-sm font-bold text-[#0c0f1a] flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 mt-2"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" /> Sign in
            </>
          )}
          <span className="absolute inset-0 -skew-x-12 translate-x-[-200%] bg-white/20 transition-transform duration-500 group-hover:translate-x-[200%]" />
        </button>

        {/* Role hint */}
        <div className="pt-2 border-t border-white/[0.06]">
          <p className="text-center text-xs text-white/25 leading-relaxed">
            Teachers and administrators are added by Kibali Academy staff.
            <br />
            Parents: use the email address registered during enrolment.
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
