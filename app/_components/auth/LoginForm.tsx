"use client";

/**
 * LoginForm.tsx
 *
 * School portal login. Three roles: Admin, Teacher, Parent.
 * - Role pills switch which portal context is shown (UI only — server validates role)
 * - loginAction fetches the real role from profiles and redirects accordingly
 * - Parents who haven't completed setup (invite_accepted=false) get a helpful message
 * - Demo quick-access buttons for testing (remove in production)
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Users,
} from "lucide-react";
import { loginSchema, type LoginFormValues } from "@/lib/types/auth";
import { loginAction } from "@/lib/actions/auth";
import { AuthLayout } from "./AuthLayout";

// ── Types ──────────────────────────────────────────────────────────────────────

type Role = "admin" | "teacher" | "parent";

interface LoginFormProps {
  redirectTo?: string;
  errorParam?: string;
}

// ── Role config ────────────────────────────────────────────────────────────────

const ROLES: {
  id: Role;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  ring: string;
}[] = [
  {
    id: "admin",
    label: "Administrator",
    description: "School management & reports",
    icon: <ShieldCheck className="h-4 w-4" />,
    accent: "bg-amber-500 text-white border-amber-500",
    ring: "focus:ring-amber-500/30 focus:border-amber-500",
  },
  {
    id: "teacher",
    label: "Teacher",
    description: "CBC assessments & timetable",
    icon: <BookOpen className="h-4 w-4" />,
    accent: "bg-emerald-600 text-white border-emerald-600",
    ring: "focus:ring-emerald-500/30 focus:border-emerald-500",
  },
  {
    id: "parent",
    label: "Parent / Guardian",
    description: "Child results & communication",
    icon: <Users className="h-4 w-4" />,
    accent: "bg-sky-600 text-white border-sky-600",
    ring: "focus:ring-sky-500/30 focus:border-sky-500",
  },
];

// Demo credentials — remove in production
const DEMO_EMAILS: Record<Role, string> = {
  admin: "admin@kibali.ac.ke",
  teacher: "j.kamau@kibali.ac.ke",
  parent: "parent@gmail.com",
};

// ── Component ──────────────────────────────────────────────────────────────────

export function LoginForm({ redirectTo, errorParam }: LoginFormProps) {
  const [role, setRole] = useState<Role>("admin");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const activeRole = ROLES.find((r) => r.id === role)!;

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: DEMO_EMAILS.admin, password: "" },
  });

  // Show URL error once via toast
  if (errorParam) {
    const msg: Record<string, string> = {
      missing_code: "The sign-in link was invalid or expired.",
      auth_error: "Authentication failed. Please try again.",
    };
    toast.error(msg[errorParam] ?? "An error occurred.", { id: "url-error" });
  }

  const handleRoleSwitch = (r: Role) => {
    setRole(r);
    // Pre-fill demo email for selected role (optional helper)
    setValue("email", DEMO_EMAILS[r]);
    setValue("password", "");
  };

  const doLogin = (email: string, password: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", email);
      fd.append("password", password);
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

  const onSubmit = (values: LoginFormValues) => {
    doLogin(values.email, values.password);
  };

  // Input style — adapts accent to selected role
  const inputCls = `
    w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm text-slate-800
    outline-none transition-all duration-200 bg-slate-50
    placeholder:text-slate-400
    ${activeRole.ring}
    focus:bg-white
  `;

  return (
    <AuthLayout>
      {/* Brand */}
      <div className="flex items-center gap-3 mb-7">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 border border-amber-200">
          <GraduationCap className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-600/80">
            Kibali Academy
          </p>
          <h1 className="text-lg font-extrabold text-slate-900 leading-tight">
            School Portal
          </h1>
        </div>
      </div>

      {/* Role selector */}
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          Sign in as
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleRoleSwitch(r.id)}
              className={[
                "flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 text-center transition-all duration-200 text-xs font-semibold",
                role === r.id
                  ? r.accent
                  : "border-slate-200 text-slate-500 bg-white hover:border-slate-300 hover:text-slate-700",
              ].join(" ")}
            >
              {r.icon}
              <span className="leading-tight">{r.label}</span>
            </button>
          ))}
        </div>

        {/* Role description */}
        <p className="mt-2 text-center text-[11px] text-slate-400">
          {activeRole.description}
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Root/server error */}
        {errors.root && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errors.root.message}
          </div>
        )}

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
            Email Address
          </label>
          <input
            type="email"
            autoComplete="email"
            placeholder="Enter your email"
            className={inputCls}
            disabled={isPending}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              Password
            </label>
            <a
              href="/auth/forgot-password"
              className="text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              Forgot password?
            </a>
          </div>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            className={inputCls}
            disabled={isPending}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* Parent help text — only shown when parent role selected */}
        {role === "parent" && (
          <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-xs text-sky-700 leading-relaxed">
            <strong>First time?</strong> Check your email for a setup link from
            Kibali Academy. If you can't find it, visit the school office and
            ask staff to resend your invite.
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className={[
            "w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2 shadow-sm mt-1",
            role === "admin"
              ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200"
              : role === "teacher"
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                : "bg-sky-600 hover:bg-sky-700 shadow-sky-200",
          ].join(" ")}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            `Sign in to ${activeRole.label} Portal →`
          )}
        </button>
      </form>

      {/* ── Demo Quick Access — REMOVE IN PRODUCTION ─────────────────────────── */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-6 pt-5 border-t border-dashed border-slate-200">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 text-center">
            Dev — Quick Demo Access
          </p>
          <div className="flex flex-col gap-2">
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => doLogin(DEMO_EMAILS[r.id], "demo1234")}
                disabled={isPending}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 text-left"
              >
                <span>{r.icon}</span>
                <span className="font-semibold">{r.label}</span>
                <span className="ml-auto text-slate-400">
                  {DEMO_EMAILS[r.id]}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
