"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, GraduationCap, ShieldCheck, BookOpen, Users, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { loginSchema, type LoginFormValues } from "@/lib/types/auth";
import Link from "next/link";
import { loginAction } from "@/lib/actions/auth";
import { AuthLayout } from "./AuthLayout";

interface LoginFormProps {
  redirectTo?: string;
  errorParam?: string;
}

const PORTAL_INFO = [
  {
    icon: ShieldCheck,
    label: "Administrators",
    description: "Management, Reports & Analytics",
    color: "text-amber-600",
  },
  {
    icon: BookOpen,
    label: "Teachers",
    description: "Assessments, Timetable & CBC",
    color: "text-emerald-600",
  },
  {
    icon: Users,
    label: "Parents",
    description: "Progress & Communication",
    color: "text-sky-600",
  },
];

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
    defaultValues: { email: "", password: "" },
  });

  // Handle URL errors
  if (errorParam) {
    const msg: Record<string, string> = {
      missing_code: "The sign-in link was invalid or expired.",
      auth_error: "Authentication failed. Please try again.",
    };
    toast.error(msg[errorParam] ?? "An error occurred.", { id: "url-error" });
  }

  const doLogin = (email: string, password: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", email);
      fd.append("password", password);

      const result = await loginAction(fd);

      if (!result.success) {
        setError("root", { message: result.message });
        toast.error(result.message);
        return;
      }

      toast.success("Welcome back! Redirecting...", { 
        duration: 1500,
        position: "top-center"
      });

      router.push(redirectTo ?? result.redirectTo ?? "/admin/dashboard");
      router.refresh();
    });
  };

  const onSubmit = (values: LoginFormValues) => {
    doLogin(values.email, values.password);
  };

  return (
    <AuthLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Mini Brand */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
            <GraduationCap className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[2px] text-amber-700">KIBALI ACADEMY</p>
            <h1 className="text-xl font-semibold text-slate-900">School Portal</h1>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
          <p className="text-slate-600 mt-2">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <AnimatePresence mode="wait">
            {errors.root && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm text-red-700 flex items-start gap-3"
              >
                ⚠️ {errors.root.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Email Address</label>
            <div className="relative">
              <input
                type="email"
                autoComplete="email"
                placeholder="you@school.ac.ke"
                disabled={isPending}
                {...register("email")}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 transition-all duration-300"
              />
            </div>
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-600">Password</label>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-amber-700 hover:text-amber-800 transition-colors font-medium"
              >
                Forgot password?
              </Link>
            </div>

            <div className="relative group">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isPending}
                {...register("password")}
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 transition-all duration-300 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={isPending}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          {/* Submit Button */}
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={isPending}
            className="w-full py-4 rounded-2xl text-base font-semibold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-amber-500/30 flex items-center justify-center gap-3 transition-all duration-300"
          >
            {isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing you in...
              </>
            ) : (
              "Sign In Securely"
            )}
          </motion.button>
        </form>

        {/* Portal Access Info */}
        <div className="mt-10 pt-8 border-t border-slate-100">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-4">
            Choose your portal
          </p>

          <div className="space-y-3">
            {PORTAL_INFO.map(({ icon: Icon, label, description, color }, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="group flex items-center gap-4 px-5 py-4 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/70 hover:bg-white transition-all duration-300 cursor-default"
              >
                <div className="w-9 h-9 rounded-xl bg-white shadow flex items-center justify-center">
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-[15px]">{label}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Secured with enterprise-grade encryption
        </p>
      </motion.div>
    </AuthLayout>
  );
}