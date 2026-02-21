export type UserRole = "admin" | "teacher" | "parent";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  avatar_url: string | null;
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  profile: Profile;
}

// Route access map — which roles can access which route prefixes
export const ROLE_ROUTES: Record<UserRole, string> = {
  admin: "/dashboard",
  teacher: "/teacher",
  parent: "/parent",
};

export const PROTECTED_PREFIXES: Record<string, UserRole[]> = {
  "/dashboard": ["admin"],
  "/students": ["admin", "teacher"],
  "/allocation": ["admin"],
  "/timetable": ["admin", "teacher"],
  "/reports": ["admin"],
  "/admission": ["admin"],
  "/teacher": ["teacher", "admin"],
  "/teacher/assess": ["admin", "teacher"],
  "/parent": ["parent"],
  "/parents": ["admin"],
  "/teachers": ["admin"],
};

// Zod schemas for auth forms
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
