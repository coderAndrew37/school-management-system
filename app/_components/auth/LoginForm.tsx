"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { loginSchema, type LoginFormValues } from "@/lib/types/auth";
import { loginAction } from "@/lib/actions/auth";
import { AuthLayout } from "./AuthLayout";

// ── Types ──────────────────────────────────────────────
type Role = "admin" | "teacher" | "parent";

interface LoginFormProps {
  redirectTo?: string;
  errorParam?: string;
}

// ── Role config ────────────────────────────────────────
const ROLES: { id: Role; label: string }[] = [
  { id: "admin", label: "Admin" },
  { id: "teacher", label: "Teacher" },
  { id: "parent", label: "Parent" },
];

const ROLE_EMAILS: Record<Role, string> = {
  admin: "admin@kibali.ac.ke",
  teacher: "j.kamau@kibali.ac.ke",
  parent: "parent@gmail.com",
};

const QUICK_ACCESS: {
  role: Role;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    role: "admin",
    label: "Admin Portal",
    description: "Headteacher — Full Access",
    color: "#2563eb",
  },
  {
    role: "teacher",
    label: "Teacher Portal",
    description: "Mark Entry & Class View",
    color: "#059669",
  },
  {
    role: "parent",
    label: "Parent Portal",
    description: "Child Results & Trends",
    color: "#0891b2",
  },
];

// ── Shared input class ─────────────────────────────────
const INPUT_CLS =
  "w-full px-[14px] py-[11px] border-[1.5px] border-[#e8edf2] rounded-lg text-[14px] outline-none transition-all duration-200 bg-[#f8fafc] text-[#0f172a] focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] placeholder:text-[#cbd5e1]";

// ── Component ──────────────────────────────────────────
export function LoginForm({ redirectTo, errorParam }: LoginFormProps) {
  const [role, setRole] = useState<Role>("admin");
  const [showCode, setShowCode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: ROLE_EMAILS.admin, password: "" },
  });

  // Handle URL error param
  if (errorParam) {
    const msg: Record<string, string> = {
      missing_code:
        "The sign-in link was invalid or expired. Please try again.",
      auth_error: "Authentication failed. Please try again.",
    };
    toast.error(msg[errorParam] ?? "An error occurred.", { id: "url-error" });
  }

  // Switch active role pill
  const handleRoleSwitch = (r: Role) => {
    setRole(r);
    setValue("email", ROLE_EMAILS[r]);
    setShowCode(r === "parent");
  };

  // Quick demo login
  const quickLogin = (r: Role) => {
    handleRoleSwitch(r);
    // Immediately submit with demo credentials
    startTransition(async () => {
      const fd = new FormData();
      fd.append("email", ROLE_EMAILS[r]);
      fd.append("password", "demo1234");
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
    <AuthLayout>
      {/* Heading */}
      <h2 className="text-[28px] font-extrabold text-[#0f172a] tracking-tight mb-[6px]">
        Welcome back 👋
      </h2>
      <p className="text-[14px] text-[#64748b] mb-[28px]">
        Sign in to your school portal
      </p>

      {/* Role pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => handleRoleSwitch(r.id)}
            className={[
              "flex items-center gap-[7px] px-[14px] py-2 border-[1.5px] rounded-full cursor-pointer text-[13px] font-semibold transition-all duration-200",
              role === r.id
                ? "bg-[#2563eb] border-[#2563eb] text-white"
                : "bg-white border-[#e8edf2] text-[#64748b] hover:border-[#2563eb] hover:text-[#2563eb]",
            ].join(" ")}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: "currentColor",
                opacity: 0.6,
              }}
            />
            {r.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="space-y-[14px] mb-5"
      >
        {/* Root error */}
        {errors.root && (
          <div className="rounded-lg border border-red-200 bg-[#fef2f2] px-4 py-3 text-[13px] text-[#dc2626]">
            {errors.root.message}
          </div>
        )}

        {/* Email */}
        <div className="flex flex-col gap-[5px]">
          <label className="text-[12px] font-bold text-[#334155] uppercase tracking-[0.6px]">
            Email / Staff ID
          </label>
          <input
            type="text"
            autoComplete="email"
            placeholder="Enter email or staff ID"
            className={INPUT_CLS}
            disabled={isPending}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-[12px] text-[#dc2626]">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-[5px]">
          <label className="text-[12px] font-bold text-[#334155] uppercase tracking-[0.6px]">
            Password
          </label>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Enter password"
            className={INPUT_CLS}
            disabled={isPending}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-[12px] text-[#dc2626]">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Parent access code (conditional) */}
        {showCode && (
          <div className="flex flex-col gap-[5px]">
            <label className="text-[12px] font-bold text-[#334155] uppercase tracking-[0.6px]">
              Access Code
            </label>
            <input
              type="text"
              placeholder="e.g. PAR-1001"
              className={INPUT_CLS}
              disabled={isPending}
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-[13px] rounded-lg border-none text-[15px] font-bold text-white cursor-pointer transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
          style={{
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            boxShadow: "0 4px 16px rgba(37,99,235,0.3)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform =
              "translateY(-1px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 8px 24px rgba(37,99,235,0.4)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 16px rgba(37,99,235,0.3)";
          }}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign In →"
          )}
        </button>
      </form>

      {/* Quick Demo Access */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.8px] text-[#94a3b8] mb-[10px]">
          Quick Demo
        </p>
        <div className="flex flex-col gap-[6px]">
          {QUICK_ACCESS.map((qa) => (
            <button
              key={qa.role}
              type="button"
              onClick={() => quickLogin(qa.role)}
              disabled={isPending}
              className="flex items-center gap-[10px] px-[14px] py-[10px] bg-[#f8fafc] border border-[#e8edf2] rounded-lg cursor-pointer transition-all duration-200 text-left w-full hover:border-[#2563eb] hover:bg-[#eff6ff] disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              <span
                className="w-[10px] h-[10px] rounded-full flex-shrink-0"
                style={{ background: qa.color }}
              />
              <span className="flex-1 text-[13px] font-bold text-[#0f172a]">
                {qa.label}
              </span>
              <span className="text-[11px] text-[#64748b]">
                {qa.description}
              </span>
              <span className="text-[12px] text-[#94a3b8] group-hover:text-[#2563eb] transition-colors">
                →
              </span>
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
